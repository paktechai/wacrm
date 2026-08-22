"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Globe2, MessageCircle, PlugZap, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Integration = {
  id: string;
  provider: string;
  name: string;
  status: string;
  last_synced_at?: string | null;
  last_error?: string | null;
};

type Widget = {
  id: string;
  public_key: string;
  name: string;
  welcome_message: string;
  allowed_origins: string[];
  is_active: boolean;
};

const providers = [
  ["shopify", "Shopify"],
  ["woocommerce", "WooCommerce"],
  ["google_sheets", "Google Sheets"],
  ["n8n", "n8n"],
  ["zapier", "Zapier"],
  ["hubspot", "HubSpot"],
  ["custom_webhook", "Custom Webhook"],
] as const;

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = createClient();
      const [integrationsRes, widgetsRes, whatsapp] = await Promise.all([
        fetch("/api/integrations", { cache: "no-store" }),
        fetch("/api/webchat/widgets", { cache: "no-store" }),
        db.from("whatsapp_config").select("status").maybeSingle(),
      ]);
      const [integrationsJson, widgetsJson] = await Promise.all([
        integrationsRes.json(),
        widgetsRes.json(),
      ]);
      if (!integrationsRes.ok) throw new Error(integrationsJson?.error || "Could not load integrations");
      if (!widgetsRes.ok) throw new Error(widgetsJson?.error || "Could not load chat widgets");
      setIntegrations(integrationsJson.integrations ?? []);
      setWidgets(widgetsJson.widgets ?? []);
      setWhatsappConnected(whatsapp.data?.status === "connected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const registered = useMemo(() => new Set(integrations.map((item) => item.provider)), [integrations]);

  async function registerIntegration(provider: string, name: string) {
    const response = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, name, settings: {} }),
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload?.error || "Could not register integration");
    setIntegrations((items) => [payload.integration, ...items]);
    toast.success(`${name} added to connection registry`);
  }

  async function createWidget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const origins = String(form.get("origins") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const response = await fetch("/api/webchat/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        welcomeMessage: form.get("welcomeMessage"),
        allowedOrigins: origins,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload?.error || "Could not create chat widget");
    event.currentTarget.reset();
    setWidgets((items) => [...items, payload.widget]);
    toast.success("Website chat widget created");
  }

  function embed(widget: Widget) {
    const base = typeof window !== "undefined" ? window.location.origin : "https://app.sbyt.app";
    return `<script src="${base}/sbyt-chat-widget.js" data-sbyt-key="${widget.public_key}" defer></script>`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Connections</div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Channels & integrations</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">One connection center for messaging channels, first-party website chat and business-system integrations.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Messaging channels</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Channel name="WhatsApp" detail={whatsappConnected ? "Connected" : "Setup available"} ready={whatsappConnected} />
          <Channel name="Website Chat" detail={widgets.length ? `${widgets.length} widget${widgets.length === 1 ? "" : "s"}` : "Ready to create"} ready={widgets.length > 0} />
          <Channel name="Instagram / Messenger" detail="Meta review required" ready={false} />
          <Channel name="SMS / RCS / TikTok" detail="Provider connection required" ready={false} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5"><div className="flex items-center gap-2"><MessageCircle className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Website Chat</h2></div><p className="mt-1 text-sm text-muted-foreground">A real second channel: visitor messages land directly in the shared inbox as webchat conversations.</p>
            <form onSubmit={createWidget} className="mt-4 space-y-3">
              <input name="name" required defaultValue="Website Chat" placeholder="Widget name" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="welcomeMessage" defaultValue="Hi! How can we help?" placeholder="Welcome message" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="origins" placeholder="Allowed origins, comma separated (optional)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="size-4" /> Create widget</button>
            </form>
          </div>
          <div className="divide-y divide-border">
            {widgets.map((widget) => (
              <div key={widget.id} className="p-4">
                <div className="flex items-center justify-between gap-3"><div><div className="font-medium text-foreground">{widget.name}</div><div className="mt-1 text-xs text-muted-foreground">{widget.allowed_origins.length ? widget.allowed_origins.join(", ") : "Any origin until restricted"}</div></div><span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Active</span></div>
                <div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-background px-3 py-2 text-[11px] text-muted-foreground">{embed(widget)}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(embed(widget)); toast.success("Embed code copied"); }} className="rounded-xl border border-border px-3 text-muted-foreground hover:text-foreground" aria-label="Copy embed code"><Copy className="size-4" /></button></div>
              </div>
            ))}
            {!loading && widgets.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Create your first website-chat widget above.</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5"><div className="flex items-center gap-2"><PlugZap className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Business integrations</h2></div><p className="mt-1 text-sm text-muted-foreground">Register the connection now. OAuth/API-secret exchange remains provider-specific and is never accepted by this generic endpoint.</p></div>
          <div className="divide-y divide-border">
            {providers.map(([provider, label]) => {
              const existing = integrations.find((item) => item.provider === provider);
              return <div key={provider} className="flex items-center justify-between gap-4 p-4"><div><div className="font-medium text-foreground">{label}</div><div className="mt-1 text-xs text-muted-foreground">{existing ? `Registry: ${existing.status}` : "Not registered"}</div></div>{existing ? <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><CheckCircle2 className="size-3" /> Ready for credentials</span> : <button type="button" onClick={() => void registerIntegration(provider, label)} className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Register</button>}</div>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Channel({ name, detail, ready }: { name: string; detail: string; ready: boolean }) {
  return <div className="rounded-xl border border-border bg-background p-4"><div className="flex items-center justify-between"><Globe2 className="size-4 text-primary" /><span className={`size-2 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} /></div><div className="mt-4 font-medium text-foreground">{name}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}
