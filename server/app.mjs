import http from 'node:http';
import {
  createOnboardingSession,
  completeOnboarding,
  completeSandboxOnboarding,
  publicMetaConfig,
} from './meta-onboarding-controller.mjs';
import { metaWebhook } from './meta-webhook-controller.mjs';
import { safeError, sendJson } from './lib/http.mjs';

const routes = new Map([
  ['GET /api/meta/public-config', publicMetaConfig],
  ['POST /api/meta/onboarding/session', createOnboardingSession],
  ['POST /api/meta/onboarding/sandbox-complete', completeSandboxOnboarding],
  ['POST /api/meta/onboarding/complete', completeOnboarding],
  ['GET /api/meta/webhook', metaWebhook],
  ['POST /api/meta/webhook', metaWebhook],
]);

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const handler = routes.get(`${req.method} ${url.pathname}`);
    if (!handler) return sendJson(res, 404, { error: 'Not found' });
    await handler(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) safeError(res, error);
  }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
