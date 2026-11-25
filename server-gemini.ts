import { GoogleGenAI, Type } from '@google/genai';

export function resolveGeminiApiKey(): string {
  const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  const candidates = [
    viteEnv?.VITE_GEMINI_API_KEY,
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

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function extractGeminiText(response: {
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

export function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export async function generateWithActiveModel(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    config?: Record<string, unknown>;
  }
) {
  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'] as const;
  let lastError: unknown;
  for (let i = 0; i < models.length; i += 1) {
    try {
      return await ai.models.generateContent({
        model: models[i],
        contents: params.contents as never,
        config: params.config as never,
      });
    } catch (err: unknown) {
      lastError = err;
      const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 0;
      const isRetryableOnAlternateModel =
        status === 503 ||
        status === 404 ||
        msg.includes('unavailable') ||
        msg.includes('high demand') ||
        msg.includes('not_found');
      if (!isRetryableOnAlternateModel || i === models.length - 1) {
        throw err;
      }
    }
  }
  throw lastError;
}

export function classifyGeminiError(err: unknown): {
  status: number;
  error: string;
  code: string;
} {
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  let extractedMessage = rawMessage;
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { code?: number; message?: string; status?: string };
      message?: string;
    };
    if (parsed?.error?.message) {
      extractedMessage = parsed.error.message;
    } else if (parsed?.message) {
      extractedMessage = parsed.message;
    }
  } catch {
    // Not JSON, keep rawMessage
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
      error: 'Invalid API key: please verify your Gemini API key in environment variables.',
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

export async function runCopilotRequest(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      status: 503,
      payload: {
        error: 'API key not configured in environment variables.',
        code: 'MISSING_API_KEY',
      },
    };
  }

  try {
    const prompt = sanitizeText(body?.prompt, 2000);
    const tone = sanitizeText(body?.tone, 80) || 'Executive HR Brief';
    const ukGuidance = Boolean(body?.ukGuidance);
    const contextSummary = sanitizeText(body?.contextSummary, 16000);
    const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];

    if (!prompt) {
      return { status: 400, payload: { error: 'Prompt is required.' } };
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

    const response = await generateWithActiveModel(ai, {
      contents: turns,
      config: {
        systemInstruction,
      },
    });

    const rawReply = extractGeminiText(response);
    const finishReason = response.candidates?.[0]?.finishReason;
    if (!rawReply) {
      const blockReason = (
        response as { promptFeedback?: { blockReason?: string } }
      )?.promptFeedback?.blockReason;
      const resolvedFinishReason = finishReason || blockReason || 'UNKNOWN';
      return {
        status: 502,
        payload: {
          error: `Gemini stopped without reply text (finishReason: ${resolvedFinishReason}). Please retry or rephrase your question.`,
          finishReason: resolvedFinishReason,
          code: 'EMPTY_RESPONSE',
        },
      };
    }

    return {
      status: 200,
      payload: {
        reply: rawReply.replace(/\s*—\s*/g, ', '),
        finishReason: finishReason || 'STOP',
        source: 'gemini',
      },
    };
  } catch (err: unknown) {
    const classified = classifyGeminiError(err);
    return {
      status: classified.status,
      payload: {
        error: classified.error,
        code: classified.code,
      },
    };
  }
}

export async function runActionPlanRequest(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      status: 503,
      payload: {
        error: 'AI helper is currently offline (no API key set). Showing built-in helpful tips instead.',
        code: 'MISSING_API_KEY',
      },
    };
  }

  try {
    const targetType = body?.targetType === 'department' ? 'department' : 'employee';
    const targetSummary = sanitizeText(body?.targetSummary, 8000);
    const tone = sanitizeText(body?.tone, 80) || 'Line Manager Coaching Script';
    const ukGuidance = Boolean(body?.ukGuidance);

    if (!targetSummary) {
      return { status: 400, payload: { error: 'Target summary is required.' } };
    }

    const systemInstruction = [
      'You are a warm, practical HR People Partner at Hay Recruitment UK.',
      `Style: ${tone}, written in simple, everyday English that any manager can use immediately in a 1-on-1 chat.`,
      ukGuidance
        ? 'Keep advice supportive and grounded in UK wellbeing and annual leave care.'
        : '',
      'Keep each bullet point to 1 short, clear sentence. Avoid jargon.',
      'Never use em dashes in your responses. Use periods, commas, or bullet points instead.',
    ]
      .filter(Boolean)
      .join(' ');

    const response = await generateWithActiveModel(ai, {
      contents: `Create a friendly, practical support tip card with 3 short action tips for this ${targetType}:\n\n${targetSummary}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            urgency: { type: Type.STRING },
            owner: { type: Type.STRING },
            diagnosis: { type: Type.STRING },
            day30Actions: { type: Type.ARRAY, items: { type: Type.STRING } },
            day60Actions: { type: Type.ARRAY, items: { type: Type.STRING } },
            day90Actions: { type: Type.ARRAY, items: { type: Type.STRING } },
            successKpis: { type: Type.ARRAY, items: { type: Type.STRING } },
            coachingOpener: { type: Type.STRING },
          },
        },
      },
    });

    const rawText = extractGeminiText(response) || '{}';
    const parsed = JSON.parse(rawText);
    return { status: 200, payload: { plan: parsed } };
  } catch (err: unknown) {
    const classified = classifyGeminiError(err);
    return {
      status: classified.status,
      payload: { error: classified.error, code: classified.code },
    };
  }
}

export async function runExecutiveBriefRequest(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      status: 503,
      payload: {
        error: 'AI helper is offline because no API key is configured.',
        code: 'MISSING_API_KEY',
      },
    };
  }

  try {
    const metricsSummary = sanitizeText(body?.metricsSummary, 14000);
    const tone = sanitizeText(body?.tone, 80) || 'Executive HR Brief';
    if (!metricsSummary) {
      return { status: 400, payload: { error: 'Metrics summary is required.' } };
    }

    const response = await generateWithActiveModel(ai, {
      contents: `Write a short, plain-English team summary (2 short paragraphs + 4 clear next steps) for Hay Recruitment leadership using only these numbers:\n\n${metricsSummary}`,
      config: {
        systemInstruction: `You are summarizing team wellbeing and workload for Hay Recruitment leadership. Style: ${tone}. Keep the language clear, human, and free of technical jargon. Never use em dashes in your responses. Use periods, commas, or bullet points instead.`,
      },
    });

    return {
      status: 200,
      payload: { brief: extractGeminiText(response).replace(/\s*—\s*/g, ', ') },
    };
  } catch (err: unknown) {
    const classified = classifyGeminiError(err);
    return {
      status: classified.status,
      payload: { error: classified.error, code: classified.code },
    };
  }
}
