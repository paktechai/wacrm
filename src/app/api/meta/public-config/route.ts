import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { runtimeMode, sandboxAssets } from '@/lib/meta/sandbox';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole('admin');
    const mode = runtimeMode();
    let sandboxConfigured = false;
    let sandboxError: string | null = null;
    if (mode === 'sandbox') {
      try {
        sandboxAssets();
        sandboxConfigured = Boolean(
          process.env.META_SANDBOX_ACCESS_TOKEN?.trim() &&
          (process.env.META_ONBOARDING_STATE_SECRET?.trim().length ?? 0) >= 32
        );
        if (!process.env.META_SANDBOX_ACCESS_TOKEN?.trim()) {
          sandboxError = 'META_SANDBOX_ACCESS_TOKEN is not configured';
        } else if (
          (process.env.META_ONBOARDING_STATE_SECRET?.trim().length ?? 0) < 32
        ) {
          sandboxError =
            'META_ONBOARDING_STATE_SECRET must be at least 32 bytes';
        }
      } catch (error) {
        sandboxError =
          error instanceof Error
            ? error.message
            : 'Sandbox configuration is incomplete';
      }
    }

    return Response.json(
      {
        runtimeMode: mode,
        graphVersion: process.env.META_GRAPH_VERSION?.trim() || 'v25.0',
        sandboxConfigured,
        sandboxError,
        webhookMode: process.env.META_WEBHOOK_MODE?.trim() || 'log_only',
        hubDispatchMode: process.env.HUB_DISPATCH_MODE?.trim() || 'simulate',
        capabilities: {
          fresh: 'test_waba_read_only',
          provider_migration: 'simulated_only',
          business_app_coexistence: 'simulated_only',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
