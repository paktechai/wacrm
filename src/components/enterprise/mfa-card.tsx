"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string | null; status?: string };

export function MfaCard({ onLevelChange }: { onLevelChange?: (level: string | null) => void }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [factorResult, aalResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorResult.error) throw factorResult.error;
    if (aalResult.error) throw aalResult.error;
    const totp = (factorResult.data?.totp ?? []) as Factor[];
    setFactors(totp);
    setCurrentLevel(aalResult.data?.currentLevel ?? null);
    onLevelChange?.(aalResult.data?.currentLevel ?? null);
    if (!factorId && totp[0]?.id) setFactorId(totp[0].id);
  }, [factorId, onLevelChange]);

  useEffect(() => {
    void refresh().catch((error) => {
      console.error("[mfa] status failed", error);
    });
  }, [refresh]);

  async function enroll() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Wova8 CRM Authenticator",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      toast.success("Authenticator enrollment started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start MFA enrollment");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!factorId || !code.trim() || busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) throw verified.error;
      setCode("");
      setQrCode("");
      setSecret("");
      await refresh();
      toast.success("Multi-factor authentication verified");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  const enrolled = factors.length > 0 || !!factorId;
  const verifiedNow = currentLevel === "aal2";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Authenticator MFA</h2></div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Use a TOTP authenticator app. When workspace MFA is required, write actions need an AAL2 session.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${verifiedNow ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-border bg-muted text-muted-foreground"}`}>
          {verifiedNow ? "AAL2 verified" : enrolled ? "Enrolled / verify" : "Not enrolled"}
        </span>
      </div>

      {!enrolled ? (
        <button type="button" disabled={busy} onClick={() => void enroll()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Enroll authenticator
        </button>
      ) : null}

      {qrCode ? (
        <div className="mt-4 grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <img src={qrCode} alt="Authenticator QR code" className="size-[180px] rounded-lg bg-white p-2" />
          <div className="min-w-0"><div className="text-sm font-medium text-foreground">Scan with your authenticator app</div><p className="mt-1 text-xs leading-5 text-muted-foreground">If scanning is unavailable, add this secret manually:</p><code className="mt-2 block overflow-x-auto rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">{secret}</code></div>
        </div>
      ) : null}

      {enrolled && !verifiedNow ? (
        <div className="mt-4 flex max-w-md gap-2">
          <input value={code} onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit authenticator code" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <button type="button" disabled={busy || !code.trim()} onClick={() => void verify()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Verify</button>
        </div>
      ) : null}

      {verifiedNow ? <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="size-4" /> Current session has completed MFA.</div> : null}
    </section>
  );
}
