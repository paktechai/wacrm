"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Download, History, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { MfaCard } from "@/components/enterprise/mfa-card";

type SecuritySettings = {
  require_mfa: boolean;
  session_timeout_minutes: number;
  data_retention_days: number;
  audit_retention_days: number;
  allow_data_export: boolean;
  allowed_ip_cidrs: string[];
};

type AuditEvent = {
  id: number;
  event: string;
  object_type?: string | null;
  object_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export default function EnterprisePage() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aal, setAal] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [securityRes, auditRes] = await Promise.all([
        fetch("/api/enterprise/security", { cache: "no-store" }),
        fetch("/api/enterprise/audit?limit=100", { cache: "no-store" }),
      ]);
      const [securityJson, auditJson] = await Promise.all([securityRes.json(), auditRes.json()]);
      if (!securityRes.ok) throw new Error(securityJson?.error || "Could not load security settings");
      if (!auditRes.ok) throw new Error(auditJson?.error || "Could not load audit log");
      setSettings(securityJson.settings);
      setAal(securityJson.mfa?.currentLevel ?? null);
      setEvents(auditJson.events ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load enterprise controls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || saving) return;
    const form = new FormData(event.currentTarget);
    const nextRequireMfa = form.get("requireMfa") === "on";
    if (nextRequireMfa && aal !== "aal2") {
      toast.error("Verify your authenticator first, then enable workspace MFA.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/enterprise/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requireMfa: nextRequireMfa,
          sessionTimeoutMinutes: Number(form.get("sessionTimeoutMinutes")),
          dataRetentionDays: Number(form.get("dataRetentionDays")),
          auditRetentionDays: Number(form.get("auditRetentionDays")),
          allowDataExport: form.get("allowDataExport") === "on",
          allowedIpCidrs: String(form.get("allowedIpCidrs") || "").split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not update security settings");
      setSettings(payload.settings);
      toast.success("Enterprise security settings saved");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update settings");
    } finally {
      setSaving(false);
    }
  }

  function exportData() {
    window.location.assign("/api/enterprise/export");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Enterprise</div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Security & governance</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Workspace MFA enforcement, retention policy, audit trail and scoped data export.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
      </div>

      <MfaCard onLevelChange={setAal} />

      {settings ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Workspace policy</h2></div>
          <form onSubmit={save} className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4"><div><div className="text-sm font-medium text-foreground">Require MFA for writes</div><div className="mt-1 text-xs text-muted-foreground">RLS and server APIs require AAL2 while reads remain available.</div></div><input name="requireMfa" type="checkbox" defaultChecked={settings.require_mfa} /></label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4"><div><div className="text-sm font-medium text-foreground">Allow account data export</div><div className="mt-1 text-xs text-muted-foreground">Admins can download a tenant-scoped JSON export.</div></div><input name="allowDataExport" type="checkbox" defaultChecked={settings.allow_data_export} /></label>
            <Field label="Session policy (minutes)" name="sessionTimeoutMinutes" min={15} max={43200} value={settings.session_timeout_minutes} />
            <Field label="Data retention (days)" name="dataRetentionDays" min={30} max={3650} value={settings.data_retention_days} />
            <Field label="Audit retention (days)" name="auditRetentionDays" min={30} max={3650} value={settings.audit_retention_days} />
            <label className="text-sm"><span className="mb-2 block font-medium text-foreground">Allowed IP CIDRs</span><input name="allowedIpCidrs" defaultValue={settings.allowed_ip_cidrs.join(", ")} placeholder="Optional: 203.0.113.0/24, ..." className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><span className="mt-1 block text-xs text-muted-foreground">Stored policy ready for reverse-proxy enforcement; leave empty to allow all.</span></label>
            <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 lg:col-span-2"><Save className="size-4" /> {saving ? "Saving…" : "Save enterprise policy"}</button>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Download className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Data portability</h2></div><p className="mt-1 text-sm text-muted-foreground">Export only this tenant’s CRM records; provider secrets and encrypted credentials are excluded.</p></div><button type="button" disabled={!settings?.allow_data_export} onClick={exportData} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"><Download className="size-4" /> Export JSON</button></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5"><div className="flex items-center gap-2"><History className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Tenant audit log</h2></div><p className="mt-1 text-sm text-muted-foreground">Latest trusted server-side security, CRM, AI, commerce and integration events.</p></div>
        <div className="divide-y divide-border">
          {events.map((event) => <div key={event.id} className="grid gap-2 p-4 sm:grid-cols-[220px_minmax(0,1fr)_180px]"><div className="font-mono text-xs text-foreground">{event.event}</div><div className="truncate text-xs text-muted-foreground">{event.object_type || "—"}{event.object_id ? ` · ${event.object_id}` : ""}</div><div className="text-xs text-muted-foreground sm:text-right">{new Date(event.created_at).toLocaleString()}</div></div>)}
          {!loading && events.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No tenant audit events yet.</div> : null}
        </div>
      </section>
    </div>
  );
}

function Field({ label, name, min, max, value }: { label: string; name: string; min: number; max: number; value: number }) {
  return <label className="text-sm"><span className="mb-2 block font-medium text-foreground">{label}</span><input name={name} type="number" min={min} max={max} defaultValue={value} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /></label>;
}
