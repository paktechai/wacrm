import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { WOVA8 } from '@/lib/brand';
import { runtimeMode, sandboxAssets } from '@/lib/meta/sandbox';

export async function GET() {
  try {
    await requireRole('admin');

    const appId = process.env.META_APP_ID?.trim() || null;
    const mode = runtimeMode();
    let sandboxConfigured = false;
    if (mode === 'sandbox') {
      try {
        sandboxAssets();
        sandboxConfigured = Boolean(
          process.env.META_SANDBOX_ACCESS_TOKEN?.trim() &&
          (process.env.META_ONBOARDING_STATE_SECRET?.trim().length ?? 0) >= 32
        );
      } catch {
        sandboxConfigured = false;
      }
    }
    const configId =
      mode === 'production'
        ? process.env.META_EMBEDDED_SIGNUP_CONFIG_ID_FRESH?.trim() || null
        : null;
    const siteUrl = WOVA8.crmUrl;

    return NextResponse.json(
      {
        configured:
          mode === 'sandbox' ? sandboxConfigured : Boolean(appId && configId),
        appId,
        configId,
        siteUrl,
        runtimeMode: mode,
        missing: [
          ...(mode === 'production' && !appId ? ['META_APP_ID'] : []),
          ...(mode === 'production' && !configId
            ? ['META_EMBEDDED_SIGNUP_CONFIG_ID_FRESH']
            : []),
          ...(mode === 'sandbox' && !sandboxConfigured
            ? ['Meta Sandbox credentials']
            : []),
        ],
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
