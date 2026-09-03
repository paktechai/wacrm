import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assertSandboxWebhookPayload,
  issueOnboardingState,
  sandboxAssets,
  verifyOnboardingState,
  verifyWebhookSignature,
} from './sandbox';

const originalEnv = { ...process.env };

describe('Meta sandbox safety boundary', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      META_RUNTIME_MODE: 'sandbox',
      META_SANDBOX_ASSET_ACK: 'I_VERIFIED_META_TEST_ASSETS',
      META_SANDBOX_WABA_ID: '200000000000002',
      META_SANDBOX_PHONE_NUMBER_ID: '300000000000003',
      META_PROTECTED_WABA_IDS: '700000000000007,800000000000008',
      META_PROTECTED_PHONE_NUMBER_IDS: '900000000000009,910000000000010',
      META_ONBOARDING_STATE_SECRET:
        'sandbox-state-secret-with-more-than-32-bytes',
      META_APP_SECRET: 'sandbox-app-secret',
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts only acknowledged Test assets outside the protected denylist', () => {
    expect(sandboxAssets()).toEqual({
      wabaId: '200000000000002',
      phoneNumberId: '300000000000003',
    });
    process.env.META_SANDBOX_WABA_ID = '700000000000007';
    expect(() => sandboxAssets()).toThrow(/protected live Meta asset/i);
  });

  it('binds state to the authenticated user, account and onboarding mode', () => {
    const issued = issueOnboardingState({
      userId: 'user-1',
      accountId: 'account-1',
      onboardingMode: 'fresh',
      now: 1_800_000_000_000,
      nonce: 'fixed-nonce',
    });
    expect(
      verifyOnboardingState(issued.state, {
        userId: 'user-1',
        accountId: 'account-1',
        now: 1_800_000_001_000,
      }).onboardingMode
    ).toBe('fresh');
    expect(() =>
      verifyOnboardingState(issued.state, {
        userId: 'other-user',
        accountId: 'account-1',
        now: 1_800_000_001_000,
      })
    ).toThrow(/mismatched/i);
  });

  it('validates the exact raw webhook HMAC', () => {
    const raw = JSON.stringify({ entry: [{ id: '200000000000002' }] });
    const signature = `sha256=${createHmac('sha256', 'sandbox-app-secret').update(raw).digest('hex')}`;
    expect(verifyWebhookSignature(raw, signature)).toBe(true);
    expect(verifyWebhookSignature(`${raw} `, signature)).toBe(false);
  });

  it('rejects every webhook that is not exclusively from the Test WABA', () => {
    expect(
      assertSandboxWebhookPayload({ entry: [{ id: '200000000000002' }] })
    ).toBe('200000000000002');
    expect(() =>
      assertSandboxWebhookPayload({ entry: [{ id: '999999999999999' }] })
    ).toThrow(/not the configured Meta Test WABA/i);
  });
});
