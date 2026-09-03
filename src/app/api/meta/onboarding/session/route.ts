import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isOnboardingMode,
  issueOnboardingState,
  metaErrorResponse,
  requireSandboxMode,
} from '@/lib/meta/sandbox';

export async function POST(request: Request) {
  try {
    requireSandboxMode();
    const account = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as {
      onboardingMode?: unknown;
    } | null;
    if (!isOnboardingMode(body?.onboardingMode)) {
      return Response.json(
        { error: 'Select a valid onboarding path' },
        { status: 400 }
      );
    }

    const issued = issueOnboardingState({
      userId: account.userId,
      accountId: account.accountId,
      onboardingMode: body.onboardingMode,
    });
    const { error } = await createAdminClient()
      .from('meta_onboarding_sessions')
      .insert({
        state_hash: issued.stateHash,
        account_id: account.accountId,
        user_id: account.userId,
        onboarding_mode: body.onboardingMode,
        expires_at: issued.expiresAt,
      });
    if (error) throw error;
    return Response.json({ state: issued.state, expiresAt: issued.expiresAt });
  } catch (error) {
    const authResponse = toErrorResponse(error);
    if (authResponse.status !== 500) return authResponse;
    return metaErrorResponse(error);
  }
}
