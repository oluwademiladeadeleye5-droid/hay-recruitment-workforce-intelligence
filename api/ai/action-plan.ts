import { GoogleGenAI, Type } from '@google/genai';

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
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}): string {
  try {
    const direct = typeof response.text === 'string' ? response.text.trim() : '';
    if (direct) return direct;
  } catch {
    // ignore
  }
  const parts = response.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .filter((p) => !p?.thought && typeof p?.text === 'string' && p.text.trim().length > 0)
      .map((p) => p.text as string)
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
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
        error: 'AI helper is currently offline (no API key set). Showing built-in helpful tips instead.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    const body = await readJsonBody(req);
    const targetType = body?.targetType === 'department' ? 'department' : 'employee';
    const targetSummary = sanitizeText(body?.targetSummary, 8000);
    const tone = sanitizeText(body?.tone, 80) || 'Line Manager Coaching Script';
    const ukGuidance = Boolean(body?.ukGuidance);

    if (!targetSummary) {
      sendJson(res, 400, { error: 'Target summary is required.' });
      return;
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

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'] as const;
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    for (let i = 0; i < models.length; i += 1) {
      try {
        response = await ai.models.generateContent({
          model: models[i],
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
        break;
      } catch (err: unknown) {
        if (i === models.length - 1) throw err;
      }
    }

    const rawText = (response ? extractGeminiText(response) : '') || '{}';
    const parsed = JSON.parse(rawText);
    sendJson(res, 200, { plan: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate action tips.';
    sendJson(res, 502, { error: msg.replace(/\s*—\s*/g, ', ') });
  }
}
