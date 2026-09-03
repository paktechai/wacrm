import crypto from 'node:crypto';
import { authenticateUser, requireMembership, supabaseRest } from './lib/supabase-rest.mjs';
import { readJson, sendJson } from './lib/http.mjs';
import {
  assertProductionRuntime,
  assertSandboxRuntime,
  runtimeMode,
  sandboxAssets,
} from './lib/runtime-policy.mjs';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const STATE_SECRET = process.env.META_ONBOARDING_STATE_SECRET;
const CONFIG_IDS = Object.freeze({
  fresh: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID_FRESH,
  provider_migration: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID_MIGRATION,
  business_app_coexistence: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID_COEXISTENCE,
});
const KEY_VERSION = Number(process.env.META_TOKEN_KEY_VERSION || '1');
const ENCRYPTION_KEY = Buffer.from(process.env.META_TOKEN_ENCRYPTION_KEY_B64 || '', 'base64');
const requiredScopes = ['whatsapp_business_management', 'whatsapp_business_messaging'];

if (!APP_ID || !APP_SECRET || !STATE_SECRET || ENCRYPTION_KEY.length !== 32) {
  throw new Error('Meta onboarding environment is incomplete');
}

const b64url = (input) => Buffer.from(input).toString('base64url');
const sign = (value) => crypto.createHmac('sha256', STATE_SECRET).update(value).digest('base64url');

function issueState(userId, accountId, onboardingMode) {
  const payload = b64url(JSON.stringify({
    sub: userId,
    accountId,
    onboardingMode,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyState(state, userId, accountId) {
  const [payload, signature] = String(state || '').split('.');
  if (!payload || !signature) throw Object.assign(new Error('Invalid onboarding state'), { status: 400 });
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw Object.assign(new Error('Invalid onboarding state'), { status: 400 });
  }
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (value.sub !== userId || value.accountId !== accountId || value.exp < Date.now() / 1000) {
    throw Object.assign(new Error('Expired or mismatched onboarding state'), { status: 400 });
  }
  return value;
}

function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return b64url(JSON.stringify({
    v: 1,
    kid: KEY_VERSION,
    alg: 'A256GCM',
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ct: ciphertext.toString('base64url'),
  }));
}

export function decryptToken(envelope) {
  const value = JSON.parse(Buffer.from(envelope, 'base64url').toString('utf8'));
  if (value.v !== 1 || value.alg !== 'A256GCM' || Number(value.kid) !== KEY_VERSION) {
    throw new Error('Unsupported token envelope');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', ENCRYPTION_KEY, Buffer.from(value.iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ct, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

async function graph(path, options = {}) {
  const response = await fetch(`${GRAPH}${path}`, options);
  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || `Meta request failed (${response.status})`);
    error.status = 502;
    throw error;
  }
  return body;
}

async function exchangeCode(code) {
  const params = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, code });
  return graph(`/oauth/access_token?${params}`);
}

async function debugToken(token) {
  const params = new URLSearchParams({ input_token: token, access_token: `${APP_ID}|${APP_SECRET}` });
  const result = await graph(`/debug_token?${params}`);
  const data = result.data || {};
  if (!data.is_valid || String(data.app_id) !== String(APP_ID)) {
    throw Object.assign(new Error('Meta issued an invalid token'), { status: 502 });
  }
  const scopes = new Set([...(data.scopes || []), ...(data.granular_scopes || []).map((x) => x.scope)]);
  const missing = requiredScopes.filter((scope) => !scopes.has(scope));
  if (missing.length) throw Object.assign(new Error(`Missing Meta permissions: ${missing.join(', ')}`), { status: 403 });
  return data;
}

async function verifyPhone(accessToken, wabaId, phoneNumberId) {
  const data = await graph(`/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,platform_type&limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const phone = data.data?.find((item) => String(item.id) === phoneNumberId);
  if (!phone) throw Object.assign(new Error('Phone number is not owned by the selected WABA'), { status: 403 });
  return phone;
}

async function subscribeApp(accessToken, wabaId) {
  await graph(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function createOnboardingSession(req, res) {
  const user = await authenticateUser(req.headers.authorization);
  const { json } = await readJson(req);
  const accountId = String(json.accountId || '');
  const onboardingMode = String(json.onboardingMode || '');
  if (!Object.hasOwn(CONFIG_IDS, onboardingMode) ||
      (runtimeMode() === 'production' && !CONFIG_IDS[onboardingMode])) {
    throw Object.assign(new Error('Unsupported onboarding mode'), { status: 400 });
  }
  await requireMembership(user.id, accountId);
  const state = issueState(user.id, accountId, onboardingMode);
  const stateHash = crypto.createHash('sha256').update(state).digest('hex');
  await supabaseRest('meta_onboarding_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: {
      state_hash: stateHash,
      account_id: accountId,
      user_id: user.id,
      onboarding_mode: onboardingMode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
  });
  sendJson(res, 200, { state });
}

export async function publicMetaConfig(req, res) {
  await authenticateUser(req.headers.authorization);
  sendJson(res, 200, {
    appId: APP_ID,
    graphVersion: GRAPH_VERSION,
    runtimeMode: runtimeMode(),
    configIds: runtimeMode() === 'production' ? CONFIG_IDS : {},
    sandboxCapabilities: {
      fresh: 'test_waba_read_only',
      provider_migration: 'simulated_only',
      business_app_coexistence: 'simulated_only',
    },
  });
}

async function consumeState(stateValue, userId, accountId) {
  const state = verifyState(stateValue, userId, accountId);
  const stateHash = crypto.createHash('sha256').update(String(stateValue)).digest('hex');
  const consumed = await supabaseRest(
    `meta_onboarding_sessions?state_hash=eq.${stateHash}&account_id=eq.${encodeURIComponent(accountId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}&consumed_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { consumed_at: new Date().toISOString() },
    }
  );
  if (!consumed?.length) {
    throw Object.assign(new Error('Onboarding state has already been used'), { status: 409 });
  }
  return state;
}

export async function completeSandboxOnboarding(req, res) {
  assertSandboxRuntime();
  const user = await authenticateUser(req.headers.authorization);
  const { json } = await readJson(req);
  const accountId = String(json.accountId || '');
  await requireMembership(user.id, accountId);
  const state = await consumeState(json.state, user.id, accountId);
  const { wabaId, phoneNumberId } = sandboxAssets();
  const accessToken = process.env.META_SANDBOX_ACCESS_TOKEN;
  if (!accessToken) throw new Error('META_SANDBOX_ACCESS_TOKEN is required');

  const phone = await verifyPhone(accessToken, wabaId, phoneNumberId);
  const isSimulation = state.onboardingMode !== 'fresh';
  sendJson(res, 200, {
    connected: false,
    verified: true,
    persisted: false,
    runtimeMode: 'sandbox',
    onboardingMode: state.onboardingMode,
    capability: isSimulation ? 'simulated_only' : 'test_waba_read_only',
    wabaId,
    phoneNumberId,
    displayPhoneNumber: phone.display_phone_number || null,
    message: isSimulation
      ? 'UI and state safety passed. Meta migration/coexistence requires a separate non-critical eligible number.'
      : 'Meta Test WABA and Test Phone Number verified read-only. No subscriber record was changed.',
  });
}

export async function completeOnboarding(req, res) {
  assertProductionRuntime();
  const user = await authenticateUser(req.headers.authorization);
  const { json } = await readJson(req);
  const accountId = String(json.accountId || '');
  await requireMembership(user.id, accountId);
  const state = await consumeState(json.state, user.id, accountId);

  const code = String(json.code || '');
  const wabaId = String(json.wabaId || '');
  const phoneNumberId = String(json.phoneNumberId || '');
  if (!code || !/^\d{5,32}$/.test(wabaId) || !/^\d{5,32}$/.test(phoneNumberId)) {
    throw Object.assign(new Error('Code, WABA ID and phone-number ID are required'), { status: 400 });
  }

  const issued = await exchangeCode(code);
  const token = issued.access_token;
  if (!token) throw Object.assign(new Error('Meta token exchange returned no token'), { status: 502 });
  const debug = await debugToken(token);
  const phone = await verifyPhone(token, wabaId, phoneNumberId);

  const conflicts = await supabaseRest(
    `whatsapp_subscribers?select=account_id&waba_id=eq.${encodeURIComponent(wabaId)}&limit=1`
  );
  if (conflicts?.[0] && conflicts[0].account_id !== accountId) {
    throw Object.assign(new Error('This WABA is already connected to another Wova8 account'), { status: 409 });
  }

  await subscribeApp(token, wabaId);
  const expiresAt = debug.expires_at ? new Date(debug.expires_at * 1000).toISOString() : null;
  const scopes = [...new Set([...(debug.scopes || []), ...(debug.granular_scopes || []).map((x) => x.scope)])];
  const record = {
    account_id: accountId,
    user_id: user.id,
    business_name: String(phone.verified_name || 'WhatsApp Business').slice(0, 160),
    encrypted_system_user_token: encryptToken(token),
    token_key_version: KEY_VERSION,
    token_expires_at: expiresAt,
    token_scopes: scopes,
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    display_phone_number: phone.display_phone_number || null,
    onboarding_mode: state.onboardingMode,
    source_solution_provider: state.onboardingMode === 'provider_migration'
      ? 'customer_authorized_existing_provider' : null,
    coexistence_status: 'active',
    onboarding_completed_at: new Date().toISOString(),
  };
  await supabaseRest('whatsapp_subscribers?on_conflict=waba_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: record,
  });
  sendJson(res, 200, {
    connected: true,
    wabaId,
    phoneNumberId,
    displayPhoneNumber: phone.display_phone_number || null,
    tokenExpiresAt: expiresAt,
  });
}
