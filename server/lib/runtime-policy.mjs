const MODES = new Set(['sandbox', 'production']);
const WEBHOOK_MODES = new Set(['log_only', 'normalize']);

export function runtimeMode() {
  const mode = process.env.META_RUNTIME_MODE || 'sandbox';
  if (!MODES.has(mode)) throw new Error('META_RUNTIME_MODE must be sandbox or production');
  if (mode === 'production' &&
      process.env.META_LIVE_ACTIVATION_ACK !== 'I_ACKNOWLEDGE_LIVE_META_ASSETS') {
    throw new Error('Production Meta runtime requires explicit live-asset activation acknowledgement');
  }
  return mode;
}

export function webhookMode() {
  const mode = process.env.META_WEBHOOK_MODE || 'log_only';
  if (!WEBHOOK_MODES.has(mode)) {
    throw new Error('META_WEBHOOK_MODE must be log_only or normalize');
  }
  if (runtimeMode() === 'sandbox' && mode !== 'log_only') {
    throw new Error('Sandbox runtime requires META_WEBHOOK_MODE=log_only');
  }
  return mode;
}

export function sandboxAssets() {
  if (process.env.META_SANDBOX_ASSET_ACK !== 'I_VERIFIED_META_TEST_ASSETS') {
    throw new Error('Meta sandbox assets require explicit test-asset acknowledgement');
  }
  const wabaId = String(process.env.META_SANDBOX_WABA_ID || '');
  const phoneNumberId = String(process.env.META_SANDBOX_PHONE_NUMBER_ID || '');
  if (!/^\d{5,32}$/.test(wabaId) || !/^\d{5,32}$/.test(phoneNumberId)) {
    throw new Error('Valid META_SANDBOX_WABA_ID and META_SANDBOX_PHONE_NUMBER_ID are required');
  }
  const protectedWabas = new Set(String(process.env.META_PROTECTED_WABA_IDS || '')
    .split(',').map((value) => value.trim()).filter(Boolean));
  const protectedPhones = new Set(String(process.env.META_PROTECTED_PHONE_NUMBER_IDS || '')
    .split(',').map((value) => value.trim()).filter(Boolean));
  if (protectedWabas.has(wabaId) || protectedPhones.has(phoneNumberId)) {
    throw new Error('A protected live Meta asset was supplied as a sandbox asset');
  }
  return Object.freeze({ wabaId, phoneNumberId });
}

export function assertSandboxRuntime() {
  if (runtimeMode() !== 'sandbox') {
    throw Object.assign(new Error('Sandbox endpoint is disabled'), { status: 404 });
  }
}

export function assertProductionRuntime() {
  if (runtimeMode() !== 'production') {
    throw Object.assign(new Error('Live Meta onboarding is disabled in sandbox mode'), { status: 403 });
  }
}

export function assertSandboxWebhookAssets(body) {
  assertSandboxRuntime();
  const { wabaId } = sandboxAssets();
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  if (!entries.length || entries.some((entry) => String(entry?.id || '') !== wabaId)) {
    throw Object.assign(new Error('Webhook WABA is not the configured Meta sandbox WABA'), { status: 403 });
  }
  return wabaId;
}

export function hubDispatchMode() {
  const mode = process.env.HUB_DISPATCH_MODE || 'simulate';
  if (!['simulate', 'dispatch'].includes(mode)) {
    throw new Error('HUB_DISPATCH_MODE must be simulate or dispatch');
  }
  if (runtimeMode() === 'sandbox' && mode !== 'simulate') {
    throw new Error('Sandbox runtime requires HUB_DISPATCH_MODE=simulate');
  }
  return mode;
}
