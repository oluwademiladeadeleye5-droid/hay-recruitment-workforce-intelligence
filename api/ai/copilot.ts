import { GoogleGenAI } from '@google/genai';

interface ApiRequest {
  method?: string;
  body?: unknown;
  on?: (event: string, cb: (chunk: Uint8Array | string) => void) => void;
}

interface ApiResponse {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string) => void;
}

function sendJson(res: ApiResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.on !== 'function') {
    return {};
  }
  const raw = await new Promise<string>((resolve) => {
    const chunks: string[] = [];
    req.on?.('data', (chunk) => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    });
    req.on?.('end', () => resolve(chunks.join('')));
    req.on?.('error', () => resolve(''));
  });
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resolveApiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
    process.env.VITE_GEMINI_API_KEY,
  ];
  for (const candidate of candidates) {
    const cleaned = (candidate || '').trim();
    if (cleaned && cleaned !== 'MY_GEMINI_API_KEY') {
      return cleaned;
    }
  }
  return '';
}

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function extractGeminiText(response: {
  text?: string;
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}): string {
  try {
    const direct = typeof response.text === 'string' ? response.text.trim() : '';
    if (direct) return direct;
  } catch {
    // Fall back to candidates[0].content.parts
  }

  const parts = response.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .filter(
        (part) =>
          !part?.thought &&
          typeof part?.text === 'string' &&
          part.text.trim().length > 0
      )
      .map((part) => part.text as string)
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
}

function classifyError(err: unknown): { status: number; error: string; code: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  let extractedMessage = rawMessage;
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { message?: string };
      message?: string;
    };
    if (parsed?.error?.message) {
      extractedMessage = parsed.error.message;
    } else if (parsed?.message) {
      extractedMessage = parsed.message;
    }
  } catch {
    // Not JSON
  }

  const normalized = `${rawMessage} ${extractedMessage}`.toLowerCase();
  const cleanExtracted = extractedMessage.replace(/\s*—\s*/g, ', ').trim();
  const errStatus =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : 0;

  if (
    errStatus === 429 ||
    normalized.includes('resource_exhausted') ||
    normalized.includes('rate limit') ||
    normalized.includes('quota')
  ) {
    return {
      status: 429,
      error: 'Quota or rate limit exceeded: please wait a moment and retry.',
      code: 'RATE_LIMIT',
    };
  }

  if (
    errStatus === 401 ||
    errStatus === 403 ||
    normalized.includes('api_key_invalid') ||
    normalized.includes('api key not valid') ||
    normalized.includes('permission_denied')
  ) {
    return {
      status: 403,
      error: 'Invalid API key: please verify your Gemini API key in Vercel environment variables.',
      code: 'INVALID_API_KEY',
    };
  }

  if (errStatus === 404 || normalized.includes('not_found')) {
    return {
      status: 404,
      error: cleanExtracted || 'Requested Gemini model is unavailable right now.',
      code: 'MODEL_UNAVAILABLE',
    };
  }

  return {
    status: 502,
    error: cleanExtracted || 'Unable to reach Gemini AI right now. Please retry.',
    code: 'UPSTREAM_ERROR',
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    const apiKey = resolveApiKey();
    if (!apiKey) {
      sendJson(res, 503, {
        error: 'API key not configured in Vercel environment variables.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    const body = await readJsonBody(req);
    const prompt = sanitizeText(body?.prompt, 2000);
    const tone = sanitizeText(body?.tone, 80) || 'Executive HR Brief';
    const ukGuidance = Boolean(body?.ukGuidance);
    const contextSummary = sanitizeText(body?.contextSummary, 16000);
    const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];

    if (!prompt) {
      sendJson(res, 400, { error: 'Prompt is required.' });
      return;
    }

    const systemInstruction = [
      'You are a friendly, clear HR People Helper for Hay Recruitment UK.',
      `Communication style: ${tone}, written in warm, everyday plain English with zero corporate or analytics jargon.`,
      ukGuidance
        ? 'Keep recommendations practical and supportive, aligned with UK annual leave and employee wellbeing best practices.'
        : 'Focus on practical workload balancing, clearing late tasks, and checking in on team mood.',
      'Use ONLY the live team numbers provided in the LIVE TEAM DATA SUMMARY below. Never invent staff IDs, names, or figures.',
      'When mentioning specific staff, write their name and ID like: **Oliver Bennett** [HAY-1042].',
      'If the user sends a greeting like "hello" or "hi", reply warmly in 1 to 2 short sentences, mention how many staff are currently in the live dataset, and suggest 2 or 3 helpful questions they can ask.',
      'For data or HR questions, format your answer cleanly with Markdown bold labels and short bullet or numbered lists (3 to 5 points max) so it is effortless to scan.',
      'Never use em dashes in your responses. Use periods, commas, or bullet points instead.',
      contextSummary ? `\n=== LIVE TEAM DATA SUMMARY ===\n${contextSummary}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const m of history) {
      const text = sanitizeText((m as { content?: unknown })?.content, 1500);
      if (!text) continue;
      const role: 'user' | 'model' =
        (m as { role?: unknown })?.role === 'user' ? 'user' : 'model';
      if (turns.length === 0 && role === 'model') continue;
      const last = turns[turns.length - 1];
      if (last && last.role === role) {
        last.parts[0].text += `\n${text}`;
      } else {
        turns.push({ role, parts: [{ text }] });
      }
    }

    const lastTurn = turns[turns.length - 1];
    if (lastTurn && lastTurn.role === 'user') {
      lastTurn.parts[0].text = prompt;
    } else {
      turns.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'] as const;
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastError: unknown = null;

    for (let i = 0; i < models.length; i += 1) {
      try {
        response = await ai.models.generateContent({
          model: models[i],
          contents: turns as never,
          config: { systemInstruction } as never,
        });
        break;
      } catch (err: unknown) {
        lastError = err;
        const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
        const status =
          typeof (err as { status?: unknown })?.status === 'number'
            ? (err as { status: number }).status
            : 0;
        const canFallback =
          status === 503 ||
          status === 404 ||
          msg.includes('unavailable') ||
          msg.includes('high demand') ||
          msg.includes('not_found');
        if (!canFallback || i === models.length - 1) {
          throw err;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Gemini AI did not return a response.');
    }

    const rawReply = extractGeminiText(response);
    const finishReason = response.candidates?.[0]?.finishReason;
    if (!rawReply) {
      const blockReason = (
        response as { promptFeedback?: { blockReason?: string } }
      )?.promptFeedback?.blockReason;
      const resolvedFinishReason = finishReason || blockReason || 'UNKNOWN';
      sendJson(res, 502, {
        error: `Gemini stopped without reply text (finishReason: ${resolvedFinishReason}). Please retry or rephrase your question.`,
        finishReason: resolvedFinishReason,
        code: 'EMPTY_RESPONSE',
      });
      return;
    }

    sendJson(res, 200, {
      reply: rawReply.replace(/\s*—\s*/g, ', '),
      finishReason: finishReason || 'STOP',
      source: 'gemini',
    });
  } catch (err: unknown) {
    const classified = classifyError(err);
    sendJson(res, classified.status, {
      error: classified.error,
      code: classified.code,
    });
  }
}
