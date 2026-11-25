import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveGeminiApiKey,
  runActionPlanRequest,
  runCopilotRequest,
  runExecutiveBriefRequest,
} from './server-gemini';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const aiConfigured = Boolean(resolveGeminiApiKey());
    res.json({ ok: true, aiConfigured });
  });

  app.post('/api/ai/copilot', async (req, res) => {
    const result = await runCopilotRequest((req.body || {}) as Record<string, unknown>);
    res.status(result.status).json(result.payload);
  });

  app.post('/api/ai/action-plan', async (req, res) => {
    const result = await runActionPlanRequest((req.body || {}) as Record<string, unknown>);
    res.status(result.status).json(result.payload);
  });

  app.post('/api/ai/executive-brief', async (req, res) => {
    const result = await runExecutiveBriefRequest((req.body || {}) as Record<string, unknown>);
    res.status(result.status).json(result.payload);
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
