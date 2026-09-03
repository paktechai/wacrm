import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  hashState,
  metaErrorResponse,
  requireSandboxMode,
  sandboxAssets,
  verifyOnboardingState,
} from '@/lib/meta/sandbox';

type MetaPhone = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
};

export async function POST(request: Request) {
  try {
    requireSandboxMode();
    const account = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as {
      state?: unknown;
    } | null;
    const stateValue = String(body?.state ?? '');
    const state = verifyOnboardingState(stateValue, {
      userId: account.userId,
      accountId: account.accountId,
    });

    const now = new Date().toISOString();
    const { data: consumed, error: consumeError } = await createAdminClient()
      .from('meta_onboarding_sessions')
      .update({ consumed_at: now })
      .eq('state_hash', hashState(stateValue))
      .eq('account_id', account.accountId)
      .eq('user_id', account.userId)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .select('state_hash')
      .maybeSingle();
    if (consumeError) throw consumeError;
    if (!consumed) {
      return Response.json(
        { error: 'This onboarding session has expired or was already used' },
        { status: 409 }
      );
    }

    if (state.onboardingMode !== 'fresh') {
      return Response.json({
        verified: true,
        persisted: false,
        onboardingMode: state.onboardingMode,
        capability: 'simulated_only',
        message:
          'Safety simulation passed. Migration and Coexistence require a separate non-critical eligible number.',
      });
    }

    const { wabaId, phoneNumberId } = sandboxAssets();
    const accessToken = process.env.META_SANDBOX_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      return Response.json(
        { error: 'META_SANDBOX_ACCESS_TOKEN is not configured' },
        { status: 503 }
      );
    }
    const version = process.env.META_GRAPH_VERSION?.trim() || 'v25.0';
    const url = new URL(
      `https://graph.facebook.com/${version}/${encodeURIComponent(wabaId)}/phone_numbers`
    );
    url.searchParams.set('fields', 'id,display_phone_number,verified_name');
    url.searchParams.set('limit', '100');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const result = (await response.json().catch(() => null)) as {
      data?: MetaPhone[];
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      return Response.json(
        {
          error:
            result?.error?.message ||
            `Meta Test API returned ${response.status}`,
        },
        { status: 502 }
      );
    }
    const phone = result?.data?.find(
      (item) => String(item.id) === phoneNumberId
    );
    if (!phone) {
      return Response.json(
        { error: 'Configured Test Phone is not owned by the Test WABA' },
        { status: 403 }
      );
    }
    return Response.json({
      verified: true,
      persisted: false,
      onboardingMode: 'fresh',
      capability: 'test_waba_read_only',
      wabaId,
      phoneNumberId,
      displayPhoneNumber: phone.display_phone_number ?? null,
      verifiedName: phone.verified_name ?? null,
      message:
        'Meta Test WABA verified read-only. No subscriber or customer state was changed.',
    });
  } catch (error) {
    const authResponse = toErrorResponse(error);
    if (authResponse.status !== 500) return authResponse;
    return metaErrorResponse(error);
  }
}
