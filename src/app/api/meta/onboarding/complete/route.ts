import { runtimeMode } from '@/lib/meta/sandbox';

export async function POST() {
  if (runtimeMode() === 'sandbox') {
    return Response.json(
      {
        error:
          'Live Meta onboarding is disabled while the sandbox lock is active',
      },
      { status: 403 }
    );
  }
  return Response.json(
    { error: 'Live activation requires a separately approved deployment' },
    { status: 503 }
  );
}
