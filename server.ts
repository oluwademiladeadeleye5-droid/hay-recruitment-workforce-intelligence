import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function resolveGeminiApiKey(): string {
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

function getGeminiClient(): GoogleGenAI | null {
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

function extractGeminiText(response: {
  text?: string;
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
}): string {
  const direct = typeof response.text === 'string' ? response.text.trim() : '';
  if (direct) return direct;

  const parts = response.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
}

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

async function generateWithActiveModel(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    config?: Record<string, unknown>;
  }
) {
  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const aiConfigured = Boolean(resolveGeminiApiKey());
    res.json({ ok: true, aiConfigured });
  });

  app.post('/api/ai/copilot', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'API key not configured in server environment variables.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    try {
      const prompt = sanitizeText(req.body?.prompt, 2000);
      const tone = sanitizeText(req.body?.tone, 80) || 'Executive HR Brief';
      const ukGuidance = Boolean(req.body?.ukGuidance);
      const contextSummary = sanitizeText(req.body?.contextSummary, 16000);
      const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required.' });
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

      // Build clean alternating user/model conversation turns for multi-turn context
      const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      for (const m of history) {
        const text = sanitizeText((m as { content?: unknown })?.content, 1500);
        if (!text) continue;
        const role: 'user' | 'model' =
          (m as { role?: unknown })?.role === 'user' ? 'user' : 'model';
        // Ensure conversation starts with a user turn
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
      if (!rawReply) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const blockReason = (response as { promptFeedback?: { blockReason?: string } })?.promptFeedback?.blockReason;
        const reasonDetail = blockReason
          ? `Request blocked (${blockReason}).`
          : finishReason
            ? `Model returned empty output (finish reason: ${finishReason}).`
            : 'Model returned an empty response.';
        res.status(502).json({
          error: `${reasonDetail} Please retry or rephrase your question.`,
          code: 'EMPTY_RESPONSE',
        });
        return;
      }

      const cleanReply = rawReply.replace(/\s*—\s*/g, ', ');

      res.json({
        reply: cleanReply,
        source: 'gemini',
      });
    } catch (err: unknown) {
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
        res.status(429).json({
          error: 'Quota or rate limit exceeded: please wait a moment and retry.',
          code: 'RATE_LIMIT',
        });
        return;
      }

      if (
        errStatus === 401 ||
        errStatus === 403 ||
        normalized.includes('api_key_invalid') ||
        normalized.includes('api key not valid') ||
        normalized.includes('permission_denied')
      ) {
        res.status(403).json({
          error: 'Invalid API key: please verify your Gemini API key in server environment variables.',
          code: 'INVALID_API_KEY',
        });
        return;
      }

      if (errStatus === 404 || normalized.includes('not_found')) {
        res.status(404).json({
          error: cleanExtracted || 'Requested Gemini model is unavailable right now.',
          code: 'MODEL_UNAVAILABLE',
        });
        return;
      }

      res.status(502).json({
        error: cleanExtracted || 'Unable to reach Gemini AI right now. Please retry.',
        code: 'UPSTREAM_ERROR',
      });
    }
  });

  app.post('/api/ai/action-plan', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI helper is currently offline (no API key set). Showing built-in helpful tips instead.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    try {
      const targetType = req.body?.targetType === 'department' ? 'department' : 'employee';
      const targetSummary = sanitizeText(req.body?.targetSummary, 8000);
      const tone = sanitizeText(req.body?.tone, 80) || 'Line Manager Coaching Script';
      const ukGuidance = Boolean(req.body?.ukGuidance);

      if (!targetSummary) {
        res.status(400).json({ error: 'Target summary is required.' });
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
      res.json({ plan: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate action tips.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/executive-brief', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI helper is offline because no API key is configured.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    try {
      const metricsSummary = sanitizeText(req.body?.metricsSummary, 14000);
      const tone = sanitizeText(req.body?.tone, 80) || 'Executive HR Brief';
      if (!metricsSummary) {
        res.status(400).json({ error: 'Metrics summary is required.' });
        return;
      }

      const response = await generateWithActiveModel(ai, {
        contents: `Write a short, plain-English team summary (2 short paragraphs + 4 clear next steps) for Hay Recruitment leadership using only these numbers:\n\n${metricsSummary}`,
        config: {
          systemInstruction: `You are summarizing team wellbeing and workload for Hay Recruitment leadership. Style: ${tone}. Keep the language clear, human, and free of technical jargon. Never use em dashes in your responses. Use periods, commas, or bullet points instead.`,
        },
      });

      res.json({ brief: extractGeminiText(response) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate summary.';
      res.status(502).json({ error: message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hay Recruitment Workforce Intelligence running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
