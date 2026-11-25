import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
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

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const aiConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    res.json({ ok: true, aiConfigured });
  });

  app.post('/api/ai/copilot', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini AI is currently offline because GEMINI_API_KEY is not configured in Settings > Secrets. All analytics, charts, and deterministic insights remain fully functional.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    try {
      const prompt = sanitizeText(req.body?.prompt, 2000);
      const tone = sanitizeText(req.body?.tone, 80) || 'Executive HR Brief';
      const ukGuidance = Boolean(req.body?.ukGuidance);
      const contextSummary = sanitizeText(req.body?.contextSummary, 16000);
      const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];

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
        'Use ONLY the live team numbers provided in the context. Never invent staff IDs, names, or figures.',
        'When mentioning specific staff, write their name and ID like: Oliver Bennett [HAY-1042].',
        'Keep every answer short, easy to scan (3 to 5 short bullet points max), and directly helpful for a manager.',
        'Never use em dashes in your responses. Use periods, commas, or bullet points instead.',
      ].join(' ');

      const conversationText = history
        .map((m: { role?: unknown; content?: unknown }) => {
          const role = m?.role === 'user' ? 'User' : 'Helper';
          const content = sanitizeText(m?.content, 1500);
          return content ? `${role}: ${content}` : '';
        })
        .filter(Boolean)
        .join('\n\n');

      const fullContents = [
        '=== LIVE TEAM DATA ===',
        contextSummary,
        conversationText ? `=== EARLIER MESSAGES ===\n${conversationText}` : '',
        `=== QUESTION ===\n${prompt}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: fullContents,
        config: {
          systemInstruction,
        },
      });

      res.json({
        reply: response.text || 'No response generated.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get an answer.';
      res.status(502).json({ error: message });
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

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
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

      const rawText = (response.text || '{}').trim();
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

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Write a short, plain-English team summary (2 short paragraphs + 4 clear next steps) for Hay Recruitment leadership using only these numbers:\n\n${metricsSummary}`,
        config: {
          systemInstruction: `You are summarizing team wellbeing and workload for Hay Recruitment leadership. Style: ${tone}. Keep the language clear, human, and free of technical jargon. Never use em dashes in your responses. Use periods, commas, or bullet points instead.`,
        },
      });

      res.json({ brief: response.text || '' });
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
