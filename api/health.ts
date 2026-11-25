import { ApiRequest, ApiResponse, resolveGeminiApiKey, sendJson } from './_gemini';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const aiConfigured = Boolean(resolveGeminiApiKey());
  sendJson(res, 200, { ok: true, aiConfigured });
}
