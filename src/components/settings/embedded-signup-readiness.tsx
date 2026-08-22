"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";

type Readiness = {
  configured: boolean;
  appId: string | null;
  configId: string | null;
  siteUrl: string | null;
  missing: string[];
};

export function EmbeddedSignupReadiness() {
  const { canEditSettings } = useAuth();
  const [status, setStatus] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Non-admin members never render this card, so there is no loading state
    // to settle for them. Avoiding a synchronous setState here also keeps the
    // effect limited to its actual job: synchronizing with the status endpoint.
    if (!canEditSettings) return;

    let cancelled = false;
    void fetch("/api/whatsapp/embedded-signup/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load Meta onboarding status");
        return (await response.json()) as Readiness;
      })
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch((error) => {
        console.error("[embedded signup readiness]", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canEditSettings]);

  if (!canEditSettings) return null;

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
            <ShieldCheck className="size-4" />
            Meta Embedded Signup
          </div>
          <h2 className="mt-2 text-base font-semibold text-foreground">
            One-click WhatsApp onboarding
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            The CRM is prepared for Meta&apos;s embedded onboarding flow. Activation requires the SBYT domain, Meta Tech Provider setup, App ID and Embedded Signup configuration ID.
          </p>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Checking
          </span>
        ) : status?.configured ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            <CheckCircle2 className="size-3" />
            Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Waiting for Meta setup
          </span>
        )}
      </div>

      {!loading && status && !status.configured ? (
        <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-100/80">
          Pending configuration: {status.missing.join(", ") || "Meta Tech Provider activation"}. Manual WhatsApp configuration below remains available for testing and existing accounts.
        </div>
      ) : null}
    </div>
  );
}
