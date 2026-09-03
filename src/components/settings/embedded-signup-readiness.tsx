'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Waypoints,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type OnboardingMode =
  'fresh' | 'provider_migration' | 'business_app_coexistence';

type Readiness = {
  runtimeMode: 'sandbox' | 'production';
  graphVersion: string;
  sandboxConfigured: boolean;
  sandboxError: string | null;
  webhookMode: string;
  hubDispatchMode: string;
};

const paths: Array<{
  id: OnboardingMode;
  title: string;
  description: string;
  icon: typeof Smartphone;
}> = [
  {
    id: 'fresh',
    title: 'Register a new business line',
    description:
      'Verify the configured Meta Test WABA and Test Phone Number without saving a subscriber.',
    icon: Smartphone,
  },
  {
    id: 'provider_migration',
    title: 'Migrate from another provider',
    description:
      'Run the protected UI and replay-safe state flow. Live provider migration remains blocked.',
    icon: Waypoints,
  },
  {
    id: 'business_app_coexistence',
    title: 'WhatsApp Business App Coexistence',
    description:
      'Validate the safe workflow only. Your critical Business App number is never contacted.',
    icon: FlaskConical,
  },
];

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export function EmbeddedSignupReadiness() {
  const { canEditSettings } = useAuth();
  const [status, setStatus] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OnboardingMode>('fresh');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/meta/public-config', {
        cache: 'no-store',
      });
      const body = await readJson(response);
      if (!response.ok)
        throw new Error(
          String(body.error || 'Could not load Meta onboarding status')
        );
      setStatus(body as unknown as Readiness);
    } catch (error) {
      setStatus(null);
      setResult({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not load Meta onboarding status',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canEditSettings) void loadStatus();
  }, [canEditSettings]);

  if (!canEditSettings) return null;

  const runSandbox = async () => {
    setRunning(true);
    setResult(null);
    try {
      const sessionResponse = await fetch('/api/meta/onboarding/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingMode: selected }),
      });
      const session = await readJson(sessionResponse);
      if (!sessionResponse.ok)
        throw new Error(String(session.error || 'Could not begin onboarding'));

      const completeResponse = await fetch(
        '/api/meta/onboarding/sandbox-complete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: session.state }),
        }
      );
      const completed = await readJson(completeResponse);
      if (!completeResponse.ok) {
        throw new Error(
          String(completed.error || 'Sandbox verification failed')
        );
      }
      setResult({
        kind: 'success',
        message: String(completed.message || 'Sandbox verification passed.'),
      });
    } catch (error) {
      setResult({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Sandbox verification failed',
      });
    } finally {
      setRunning(false);
    }
  };

  const ready = status?.runtimeMode === 'sandbox' && status.sandboxConfigured;

  return (
    <>
      <div className="border-border bg-card mb-5 rounded-2xl border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-primary flex items-center gap-2 text-xs font-semibold tracking-[0.13em] uppercase">
              <ShieldCheck className="size-4" />
              Meta Embedded Signup
            </div>
            <h2 className="text-foreground mt-2 text-base font-semibold">
              Connect WhatsApp safely
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-5">
              Open the Wova8 onboarding workspace for new lines, provider
              migration and Coexistence. The current build is locked to Meta
              Test assets and log-only webhooks.
            </p>
          </div>
          {loading ? (
            <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <Loader2 className="size-3 animate-spin" /> Checking
            </span>
          ) : ready ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
              <CheckCircle2 className="size-3" /> Sandbox ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-600/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-amber-800 uppercase dark:text-amber-300">
              Sandbox setup required
            </span>
          )}
        </div>

        <div className="border-border bg-background/70 mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-xs leading-5">
            <span className="text-foreground font-semibold">Safety:</span>{' '}
            {status
              ? `${status.runtimeMode} · webhook ${status.webhookMode} · hub ${status.hubDispatchMode}`
              : 'Status unavailable'}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadStatus()}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setResult(null);
                setOpen(true);
              }}
            >
              Open onboarding <ArrowRight />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-popover max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
          <DialogHeader className="border-border border-b px-5 py-5 pr-12 sm:px-6">
            <div className="text-primary mb-1 flex items-center gap-2 text-xs font-semibold tracking-[0.13em] uppercase">
              <ShieldCheck className="size-4" /> Wova8 protected workspace
            </div>
            <DialogTitle className="text-popover-foreground text-xl">
              WhatsApp onboarding
            </DialogTitle>
            <DialogDescription>
              Choose a path. Sandbox mode never opens Embedded Signup against
              your protected live numbers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              {paths.map((path) => {
                const Icon = path.icon;
                const active = selected === path.id;
                return (
                  <button
                    key={path.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelected(path.id);
                      setResult(null);
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 ring-primary/30 ring-1'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-accent/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="bg-primary/10 text-primary rounded-lg p-2">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="text-foreground block text-sm font-semibold">
                          {path.title}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-xs leading-5">
                          {path.description}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-border bg-card rounded-xl border p-5">
              <div className="text-primary text-xs font-semibold tracking-wider uppercase">
                Current protection
              </div>
              <ul className="text-muted-foreground mt-3 space-y-2 text-xs leading-5">
                <li>• Live onboarding and subscriber mutation are blocked.</li>
                <li>• Only the configured Test WABA can be inspected.</li>
                <li>• Webhooks remain raw and log-only.</li>
                <li>• GitHub Hub dispatch remains simulation-only.</li>
              </ul>
              {!ready ? (
                <div className="mt-4 rounded-lg border border-amber-600/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
                  {status?.sandboxError ||
                    'Hostinger Meta Sandbox variables are not configured yet.'}
                </div>
              ) : null}
              {result ? (
                <div
                  role="status"
                  className={`mt-4 rounded-lg border p-3 text-xs leading-5 ${
                    result.kind === 'success'
                      ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }`}
                >
                  {result.message}
                </div>
              ) : null}
              <Button
                type="button"
                className="mt-5 w-full"
                onClick={() => void runSandbox()}
                disabled={!ready || running}
              >
                {running ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FlaskConical />
                )}
                {selected === 'fresh'
                  ? 'Verify Meta Test WABA'
                  : 'Run safe simulation'}
              </Button>
              {!ready ? (
                <p className="text-muted-foreground mt-2 text-center text-[11px]">
                  Action unlocks only after verified Meta Test credentials are
                  configured on staging.
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
