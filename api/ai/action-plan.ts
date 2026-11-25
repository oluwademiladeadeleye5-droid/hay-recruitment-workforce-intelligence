import {
  ApiRequest,
  ApiResponse,
  readJsonBody,
  runActionPlanRequest,
  sendJson,
} from '../_gemini';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readJsonBody(req);
  const result = await runActionPlanRequest(body);
  sendJson(res, result.status, result.payload);
}
