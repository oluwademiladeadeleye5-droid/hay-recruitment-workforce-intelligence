interface ApiResponse {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string) => void;
}

interface ApiRequest {
  method?: string;
}

function sendJson(res: ApiResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method && req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    const candidates = [
      process.env.GEMINI_API_KEY,
      process.env.API_KEY,
      process.env.VITE_GEMINI_API_KEY,
    ];
    const aiConfigured = candidates.some((val) => {
      const cleaned = (val || '').trim();
      return Boolean(cleaned && cleaned !== 'MY_GEMINI_API_KEY');
    });

    sendJson(res, 200, { ok: true, aiConfigured });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Health check failed.';
    sendJson(res, 500, { ok: false, error: msg });
  }
}
