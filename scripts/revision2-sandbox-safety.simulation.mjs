import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';

Object.assign(process.env, {
  META_RUNTIME_MODE: 'sandbox',
  META_WEBHOOK_MODE: 'log_only',
  HUB_DISPATCH_MODE: 'simulate',
  SUPABASE_URL: 'https://sandbox-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sandbox-publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'sandbox-service-role',
  META_APP_ID: '100000000000001',
  META_APP_SECRET: 'sandbox-app-secret',
  META_GRAPH_VERSION: 'v25.0',
  META_SANDBOX_WABA_ID: '200000000000002',
  META_SANDBOX_PHONE_NUMBER_ID: '300000000000003',
  META_SANDBOX_ACCESS_TOKEN: 'sandbox-test-token',
  META_SANDBOX_ASSET_ACK: 'I_VERIFIED_META_TEST_ASSETS',
  META_PROTECTED_WABA_IDS: '700000000000007,800000000000008',
  META_PROTECTED_PHONE_NUMBER_IDS: '900000000000009,910000000000010',
  META_WEBHOOK_VERIFY_TOKEN: 'sandbox-verify-token',
  META_ONBOARDING_STATE_SECRET: 'sandbox-state-secret-with-more-than-32-bytes',
  META_TOKEN_ENCRYPTION_KEY_B64: Buffer.alloc(32, 7).toString('base64'),
  META_TOKEN_KEY_VERSION: '1',
});

const calls = [];
const eventKeys = new Set();
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  const method = options.method || 'GET';
  calls.push({ url, method, body: options.body ? JSON.parse(options.body) : null });

  if (url.endsWith('/auth/v1/user')) {
    return Response.json({ id: '40000000-0000-4000-8000-000000000004' });
  }
  if (url.includes('/rest/v1/profiles?')) {
    return Response.json([{ account_id: '50000000-0000-4000-8000-000000000005' }]);
  }
  if (url.includes('/rest/v1/meta_onboarding_sessions') && method === 'POST') {
    return new Response(null, { status: 201 });
  }
  if (url.includes('/rest/v1/meta_onboarding_sessions?') && method === 'PATCH') {
    return Response.json([{}]);
  }
  if (url.includes('/rest/v1/meta_webhook_events') && method === 'POST') {
    const key = options.body ? JSON.parse(options.body).event_key : '';
    if (eventKeys.has(key)) return Response.json([], { status: 201 });
    eventKeys.add(key);
    return Response.json([{ event_key: key }], { status: 201 });
  }
  if (url.includes('/200000000000002/phone_numbers')) {
    assert.equal(options.headers.Authorization, 'Bearer sandbox-test-token');
    return Response.json({ data: [{
      id: '300000000000003',
      display_phone_number: '+1 555 0100',
      verified_name: 'Meta Test Number',
    }] });
  }
  throw new Error(`Unexpected network request: ${method} ${url}`);
};

const onboarding = await import('../server/meta-onboarding-controller.mjs');
const { metaWebhook } = await import('../server/meta-webhook-controller.mjs');

function request(method, url, body, headers = {}) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  return stream;
}

function responseCapture() {
  return {
    status: null,
    headers: null,
    body: '',
    headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    end(value = '') { this.body = String(value); },
    json() { return this.body ? JSON.parse(this.body) : null; },
  };
}

test('sandbox onboarding verifies only configured Test WABA and never persists a subscriber', async () => {
  calls.length = 0;
  const accountId = '50000000-0000-4000-8000-000000000005';
  const auth = { authorization: 'Bearer user-session' };
  const sessionRes = responseCapture();
  await onboarding.createOnboardingSession(
    request('POST', '/api/meta/onboarding/session', { accountId, onboardingMode: 'fresh' }, auth),
    sessionRes,
  );
  assert.equal(sessionRes.status, 200);

  const completeRes = responseCapture();
  await onboarding.completeSandboxOnboarding(
    request('POST', '/api/meta/onboarding/sandbox-complete', {
      accountId,
      state: sessionRes.json().state,
    }, auth),
    completeRes,
  );
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.json().persisted, false);
  assert.equal(completeRes.json().wabaId, process.env.META_SANDBOX_WABA_ID);
  assert.ok(!calls.some((call) => call.url.includes('/whatsapp_subscribers')));
  assert.ok(!calls.some((call) => call.url.includes('/subscribed_apps')));
});

test('live completion route is hard-blocked in sandbox before authentication or Meta access', async () => {
  calls.length = 0;
  await assert.rejects(
    onboarding.completeOnboarding(request('POST', '/api/meta/onboarding/complete', {}), responseCapture()),
    (error) => error.status === 403 && /disabled in sandbox/i.test(error.message),
  );
  assert.equal(calls.length, 0);
});

test('signed webhook is log-only and a replay cannot create normalized data', async () => {
  calls.length = 0;
  eventKeys.clear();
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: process.env.META_SANDBOX_WABA_ID,
      changes: [{ field: 'messages', value: { messages: [{ id: 'wamid.test', from: '15550101', timestamp: '1700000000', type: 'text' }] } }],
    }],
  };
  const raw = JSON.stringify(payload);
  const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(raw).digest('hex')}`;
  for (const duplicate of [false, true]) {
    const res = responseCapture();
    const req = Readable.from([Buffer.from(raw)]);
    Object.assign(req, { method: 'POST', url: '/api/meta/webhook', headers: { 'x-hub-signature-256': signature } });
    await metaWebhook(req, res);
    assert.equal(res.status, 200);
    assert.equal(res.json().duplicate, duplicate);
    assert.equal(res.json().mode, 'log_only');
  }
  const writes = calls.filter((call) => call.method !== 'GET' && call.method !== 'HEAD');
  assert.ok(writes.length === 2 && writes.every((call) => call.url.includes('/meta_webhook_events')));
  assert.ok(!calls.some((call) => /whatsapp_(subscribers|synced_contacts|synced_messages)/.test(call.url)));
});

test('webhook from any non-sandbox WABA is rejected before Supabase access', async () => {
  calls.length = 0;
  const payload = { object: 'whatsapp_business_account', entry: [{ id: '999999999999999', changes: [{ field: 'messages', value: {} }] }] };
  const raw = JSON.stringify(payload);
  const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(raw).digest('hex')}`;
  const req = Readable.from([Buffer.from(raw)]);
  Object.assign(req, { method: 'POST', url: '/api/meta/webhook', headers: { 'x-hub-signature-256': signature } });
  await assert.rejects(metaWebhook(req, responseCapture()), (error) => error.status === 403);
  assert.equal(calls.length, 0);
});

test('browser bridge cannot load the Facebook SDK on its sandbox branch', async () => {
  const source = await readFile(new URL('../public/js/meta-embedded-signup.js', import.meta.url), 'utf8');
  const sandboxBranch = source.indexOf("if (cfg.runtimeMode === 'sandbox')");
  const sdkLoad = source.indexOf('await loadFacebookSdk()', sandboxBranch);
  const sandboxReturn = source.indexOf('return;', sandboxBranch);
  assert.ok(sandboxBranch >= 0 && sandboxReturn > sandboxBranch && sdkLoad > sandboxReturn);
});

test('protected live IDs cannot be reused as sandbox assets', async () => {
  const policy = await import('../server/lib/runtime-policy.mjs');
  const original = process.env.META_SANDBOX_WABA_ID;
  process.env.META_SANDBOX_WABA_ID = '700000000000007';
  assert.throws(() => policy.sandboxAssets(), /protected live Meta asset/i);
  process.env.META_SANDBOX_WABA_ID = original;
});

test('Hub relay defaults to simulation before any GitHub request', async () => {
  const edge = await readFile(new URL('../supabase/functions/dispatch-hub-update/index.ts', import.meta.url), 'utf8');
  const defaultSimulation = edge.indexOf("Deno.env.get('HUB_DISPATCH_MODE') || 'simulate'");
  const simulationReturn = edge.indexOf('simulated: true', defaultSimulation);
  const githubFetch = edge.indexOf('https://api.github.com/repos/', defaultSimulation);
  assert.ok(defaultSimulation >= 0 && simulationReturn > defaultSimulation && githubFetch > simulationReturn);

  const workflow = await readFile(new URL('../.github/workflows/sync-supabase-hub.yml', import.meta.url), 'utf8');
  assert.match(workflow, /if: github\.event\.client_payload\.environment == 'production'/);
});
