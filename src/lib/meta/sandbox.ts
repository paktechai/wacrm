import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export const META_ONBOARDING_MODES = [
  'fresh',
  'provider_migration',
  'business_app_coexistence',
] as const;

export type MetaOnboardingMode = (typeof META_ONBOARDING_MODES)[number];

type StatePayload = {
  sub: string;
  accountId: string;
  onboardingMode: MetaOnboardingMode;
  nonce: string;
  exp: number;
};

export class MetaSandboxError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'MetaSandboxError';
  }
}

function csvSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function requireSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MetaSandboxError(`${name} is not configured`, 503);
  return value;
}

export function runtimeMode(): 'sandbox' | 'production' {
  const mode = process.env.META_RUNTIME_MODE?.trim() || 'sandbox';
  if (mode !== 'sandbox' && mode !== 'production') {
    throw new MetaSandboxError(
      'META_RUNTIME_MODE must be sandbox or production',
      503
    );
  }
  if (
    mode === 'production' &&
    process.env.META_LIVE_ACTIVATION_ACK !== 'I_ACKNOWLEDGE_LIVE_META_ASSETS'
  ) {
    throw new MetaSandboxError('Live Meta activation is not acknowledged', 503);
  }
  return mode;
}

export function requireSandboxMode(): void {
  if (runtimeMode() !== 'sandbox') {
    throw new MetaSandboxError('Sandbox endpoint is disabled', 404);
  }
}

export function sandboxAssets(): { wabaId: string; phoneNumberId: string } {
  requireSandboxMode();
  if (process.env.META_SANDBOX_ASSET_ACK !== 'I_VERIFIED_META_TEST_ASSETS') {
    throw new MetaSandboxError(
      'Meta Test assets have not been acknowledged',
      503
    );
  }

  const wabaId = process.env.META_SANDBOX_WABA_ID?.trim() || '';
  const phoneNumberId = process.env.META_SANDBOX_PHONE_NUMBER_ID?.trim() || '';
  if (!/^\d{5,32}$/.test(wabaId) || !/^\d{5,32}$/.test(phoneNumberId)) {
    throw new MetaSandboxError(
      'Valid Meta Test WABA and phone-number IDs are required',
      503
    );
  }

  if (
    csvSet(process.env.META_PROTECTED_WABA_IDS).has(wabaId) ||
    csvSet(process.env.META_PROTECTED_PHONE_NUMBER_IDS).has(phoneNumberId)
  ) {
    throw new MetaSandboxError(
      'A protected live Meta asset was supplied as a sandbox asset',
      503
    );
  }
  return { wabaId, phoneNumberId };
}

export function isOnboardingMode(value: unknown): value is MetaOnboardingMode {
  return META_ONBOARDING_MODES.includes(value as MetaOnboardingMode);
}

function stateSecret(): string {
  const value = requireSecret('META_ONBOARDING_STATE_SECRET');
  if (Buffer.byteLength(value) < 32) {
    throw new MetaSandboxError(
      'META_ONBOARDING_STATE_SECRET must be at least 32 bytes',
      503
    );
  }
  return value;
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', stateSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function issueOnboardingState(input: {
  userId: string;
  accountId: string;
  onboardingMode: MetaOnboardingMode;
  now?: number;
  nonce?: string;
}): { state: string; stateHash: string; expiresAt: string } {
  const now = input.now ?? Date.now();
  const payload: StatePayload = {
    sub: input.userId,
    accountId: input.accountId,
    onboardingMode: input.onboardingMode,
    nonce: input.nonce ?? randomUUID(),
    exp: Math.floor(now / 1000) + 10 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const state = `${encoded}.${sign(encoded)}`;
  return {
    state,
    stateHash: hashState(state),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyOnboardingState(
  state: unknown,
  expected: { userId: string; accountId: string; now?: number }
): StatePayload {
  const [encoded, suppliedSignature, extra] = String(state ?? '').split('.');
  if (!encoded || !suppliedSignature || extra) {
    throw new MetaSandboxError('Invalid onboarding state');
  }
  const expectedSignature = sign(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const wanted = Buffer.from(expectedSignature);
  if (supplied.length !== wanted.length || !timingSafeEqual(supplied, wanted)) {
    throw new MetaSandboxError('Invalid onboarding state');
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as StatePayload;
  } catch {
    throw new MetaSandboxError('Invalid onboarding state');
  }
  const nowSeconds = Math.floor((expected.now ?? Date.now()) / 1000);
  if (
    payload.sub !== expected.userId ||
    payload.accountId !== expected.accountId ||
    !isOnboardingMode(payload.onboardingMode) ||
    !Number.isFinite(payload.exp) ||
    payload.exp < nowSeconds
  ) {
    throw new MetaSandboxError('Expired or mismatched onboarding state');
  }
  return payload;
}

export function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const supplied = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', requireSecret('META_APP_SECRET'))
    .update(rawBody)
    .digest('hex');
  const suppliedBuffer = Buffer.from(supplied, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

export function assertSandboxWebhookPayload(body: unknown): string {
  const { wabaId } = sandboxAssets();
  const entries =
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { entry?: unknown }).entry)
      ? (body as { entry: Array<{ id?: unknown }> }).entry
      : [];
  if (
    !entries.length ||
    entries.some((entry) => String(entry?.id ?? '') !== wabaId)
  ) {
    throw new MetaSandboxError(
      'Webhook WABA is not the configured Meta Test WABA',
      403
    );
  }
  return wabaId;
}

export function metaErrorResponse(error: unknown): Response {
  if (error instanceof MetaSandboxError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('[meta sandbox]', error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
