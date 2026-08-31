"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Beaker, Megaphone, MousePointerClick, Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Segment = { id: string; name: string; description?: string | null; filter: Record<string, unknown>; is_dynamic: boolean; created_at: string };
type Experiment = { id: string; name: string; experiment_key: string; goal: string; status: string; winner_variant?: string | null; created_at: string };
type Broadcast = { id: string; name: string; sent_count: number; delivered_count: number; read_count: number; replied_count: number; attributed_conversions?: number; created_at: string };

export default function MarketingPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = createClient();
      const [segmentRes, experimentRes, broadcastRes] = await Promise.all([
        fetch("/api/marketing/segments", { cache: "no-store" }),
        fetch("/api/marketing/experiments", { cache: "no-store" }),
        db.from("broadcasts").select("id,name,sent_count,delivered_count,read_count,replied_count,attributed_conversions,created_at").order("created_at", { ascending: false }).limit(25),
      ]);
      const [segmentJson, experimentJson] = await Promise.all([segmentRes.json(), experimentRes.json()]);
      if (!segmentRes.ok) throw new Error(segmentJson?.error || "Could not load segments");
      if (!experimentRes.ok) throw new Error(experimentJson?.error || "Could not load experiments");
      if (broadcastRes.error) throw broadcastRes.error;
      setSegments(segmentJson.segments ?? []);
      setExperiments(experimentJson.experiments ?? []);
      setBroadcasts((broadcastRes.data as Broadcast[]) ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load marketing workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => broadcasts.reduce((acc, item) => ({
    sent: acc.sent + (item.sent_count || 0),
    read: acc.read + (item.read_count || 0),
    replies: acc.replies + (item.replied_count || 0),
    conversions: acc.conversions + (item.attributed_conversions || 0),
  }), { sent: 0, read: 0, replies: 0, conversions: 0 }), [broadcasts]);

  async function createSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lifecycle = String(form.get("lifecycle") || "");
    const minScore = Number(form.get("minScore") || 0);
    const response = await fetch("/api/marketing/segments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), description: form.get("description"), filter: { lifecycle_stage: lifecycle || undefined, min_lead_score: minScore || undefined }, isDynamic: true }),
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload?.error || "Could not create segment");
    event.currentTarget.reset();
    setSegments((items) => [payload.segment, ...items]);
    toast.success("Dynamic segment created");
  }

  async function createExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/marketing/experiments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("experimentName"), experimentKey: form.get("experimentKey"), goal: form.get("goal") }),
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload?.error || "Could not create experiment");
    event.currentTarget.reset();
    setExperiments((items) => [payload.experiment, ...items]);
    toast.success("A/B experiment created");
  }

  return (
    <div className="space-y-6">
      <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Growth suite</div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Marketing intelligence</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Saved audiences, campaign experimentation, broadcast performance and attribution-ready growth data.</p></div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Megaphone className="size-4" />} label="Messages sent" value={totals.sent} />
        <Metric icon={<MousePointerClick className="size-4" />} label="Read" value={totals.read} />
        <Metric icon={<UsersRound className="size-4" />} label="Replies" value={totals.replies} />
        <Metric icon={<Beaker className="size-4" />} label="Attributed conversions" value={totals.conversions} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5"><h2 className="font-semibold text-foreground">Dynamic segments</h2><p className="mt-1 text-sm text-muted-foreground">Save audience logic now and reuse it for campaigns/automation.</p>
            <form onSubmit={createSegment} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Segment name" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="description" placeholder="Description" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <select name="lifecycle" className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="">Any lifecycle</option><option value="new">New</option><option value="qualified">Qualified</option><option value="opportunity">Opportunity</option><option value="customer">Customer</option><option value="inactive">Inactive</option></select>
              <input name="minScore" type="number" min="0" max="100" placeholder="Minimum lead score" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2"><Plus className="size-4" /> Save segment</button>
            </form>
          </div>
          <div className="divide-y divide-border">{segments.map((segment) => <div key={segment.id} className="p-4"><div className="font-medium text-foreground">{segment.name}</div><div className="mt-1 text-xs text-muted-foreground">{segment.description || "Dynamic saved audience"}</div><pre className="mt-2 overflow-x-auto rounded-lg bg-background px-3 py-2 text-[11px] text-muted-foreground">{JSON.stringify(segment.filter)}</pre></div>)}{!loading && segments.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No saved segments yet.</div> : null}</div>
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5"><h2 className="font-semibold text-foreground">A/B experiments</h2><p className="mt-1 text-sm text-muted-foreground">Group broadcast variants under one experiment key and pick a measurable goal.</p>
            <form onSubmit={createExperiment} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="experimentName" required placeholder="Experiment name" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="experimentKey" required pattern="[a-z0-9][a-z0-9_-]{1,63}" placeholder="summer_offer_a_b" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <select name="goal" defaultValue="reply_rate" className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="delivery_rate">Delivery rate</option><option value="read_rate">Read rate</option><option value="reply_rate">Reply rate</option><option value="conversion_rate">Conversion rate</option></select>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Beaker className="size-4" /> Create experiment</button>
            </form>
          </div>
          <div className="divide-y divide-border">{experiments.map((experiment) => <div key={experiment.id} className="flex items-center justify-between gap-4 p-4"><div><div className="font-medium text-foreground">{experiment.name}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{experiment.experiment_key} · {experiment.goal.replace("_", " ")}</div></div><span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{experiment.status}</span></div>)}{!loading && experiments.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No experiments yet.</div> : null}</div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold text-foreground">Attribution readiness</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">The data model now captures UTM fields, CTWA click/ad identifiers, first/last/conversion touch, and broadcast-level attributed replies/conversions. Meta ad attribution starts populating automatically once the Meta onboarding/webhook credentials are available.</p></section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><span className="text-primary">{icon}</span></div><div className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground">{value.toLocaleString()}</div></div>; }
