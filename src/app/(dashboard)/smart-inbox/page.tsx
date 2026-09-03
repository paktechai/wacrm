"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmClock, Filter, MessageSquare, RefreshCw, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { ConversationIntelligenceBar } from "@/components/inbox/conversation-intelligence-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Conversation } from "@/types";

type SmartConversation = Conversation & {
  priority?: "low" | "normal" | "high" | "urgent";
  snoozed_until?: string | null;
  first_response_due_at?: string | null;
  resolution_due_at?: string | null;
  customer_sentiment?: "positive" | "neutral" | "negative" | "unknown";
  detected_intent?: string | null;
  ai_summary?: string | null;
  next_action?: string | null;
  channel?: string;
};

export default function SmartInboxPage() {
  const [items, setItems] = useState<SmartConversation[]>([]);
  const [active, setActive] = useState<SmartConversation | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = createClient();
      const { data, error } = await db
        .from("conversations")
        .select("id, user_id, account_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, created_at, updated_at, priority, snoozed_until, first_response_due_at, resolution_due_at, customer_sentiment, detected_intent, ai_summary, next_action, channel, contact:contacts(id,user_id,account_id,phone,name,email,company,avatar_url,created_at,updated_at)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(250);
      if (error) throw error;
      const normalized = (data ?? []).map((row) => ({
        ...row,
        contact: Array.isArray(row.contact) ? row.contact[0] ?? undefined : row.contact ?? undefined,
      })) as unknown as SmartConversation[];
      setItems(normalized);
      setActive((current) => normalized.find((item) => item.id === current?.id) ?? normalized[0] ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load smart inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (priority !== "all" && (item.priority ?? "normal") !== priority) return false;
      if (!q) return true;
      return [item.contact?.name, item.contact?.phone, item.contact?.email, item.last_message_text, item.detected_intent, item.channel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, search, priority]);

  function applyPatch(patch: Partial<SmartConversation>) {
    if (!active) return;
    setActive((current) => (current ? { ...current, ...patch } : current));
    setItems((current) => current.map((item) => item.id === active.id ? { ...item, ...patch } : item));
  }

  async function setSla(hours: number) {
    if (!active) return;
    const due = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const response = await fetch(`/api/inbox/conversations/${active.id}/ops`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstResponseDueAt: due, resolutionDueAt: due }),
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload?.error || "Could not set SLA");
    applyPatch(payload.conversation);
    toast.success(`${hours}h SLA set`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Modern Inbox</div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Smart conversation operations</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Prioritize, snooze, track SLA, view channel/AI intelligence and jump straight into the existing realtime chat thread.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
            <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contact, message, intent or channel" className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
            <Select
              value={priority}
              onValueChange={(value) => {
                if (value) setPriority(value);
              }}
            >
              <SelectTrigger
                aria-label="Filter by priority"
                className="h-9 w-full rounded-xl border-border bg-background px-3 text-foreground shadow-none hover:bg-muted/40 sm:w-44 dark:bg-background dark:hover:bg-muted/40"
              >
                <Filter className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="border border-border bg-popover text-popover-foreground shadow-xl"
              >
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((item) => {
              const selected = active?.id === item.id;
              const snoozed = item.snoozed_until && new Date(item.snoozed_until).getTime() > Date.now();
              return <button key={item.id} type="button" onClick={() => setActive(item)} className={`grid w-full gap-2 p-4 text-left transition sm:grid-cols-[minmax(0,1fr)_130px_100px] ${selected ? "bg-primary/8" : "hover:bg-muted/25"}`}>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-medium text-foreground">{item.contact?.name || item.contact?.phone || "Unknown contact"}</span><span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{item.channel || "whatsapp"}</span>{snoozed ? <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">Snoozed</span> : null}</div><div className="mt-1 truncate text-xs text-muted-foreground">{item.last_message_text || "No messages yet"}</div>{item.detected_intent ? <div className="mt-1 flex items-center gap-1 text-[11px] text-primary"><Sparkles className="size-3" /> {item.detected_intent}</div> : null}</div>
                <div className="text-xs text-muted-foreground"><span className="block font-medium capitalize text-foreground">{item.priority || "normal"}</span>{item.customer_sentiment && item.customer_sentiment !== "unknown" ? <span className="mt-1 block capitalize">{item.customer_sentiment}</span> : null}</div>
                <div className="text-xs text-muted-foreground sm:text-right">{item.last_message_at ? new Date(item.last_message_at).toLocaleString() : "—"}{item.unread_count > 0 ? <span className="ml-2 inline-flex min-w-5 justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{item.unread_count}</span> : null}</div>
              </button>;
            })}
            {!loading && filtered.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No conversations match these filters.</div> : null}
          </div>
        </section>

        <aside className="h-fit overflow-hidden rounded-2xl border border-border bg-card xl:sticky xl:top-0">
          {active ? <>
            <ConversationIntelligenceBar conversation={active} onChanged={applyPatch} />
            <div className="space-y-5 p-5">
              <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selected conversation</div><div className="mt-2 text-lg font-semibold text-foreground">{active.contact?.name || active.contact?.phone || "Unknown contact"}</div><div className="mt-1 text-xs text-muted-foreground">{active.channel || "whatsapp"} · {active.status}</div></div>
              {active.ai_summary ? <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">AI summary</div><p className="mt-2 text-sm leading-6 text-foreground">{active.ai_summary}</p></div> : null}
              <div><div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><AlarmClock className="size-3.5" /> Quick SLA</div><div className="grid grid-cols-3 gap-2">{[1,4,24].map((hours) => <button key={hours} type="button" onClick={() => void setSla(hours)} className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">{hours}h</button>)}</div></div>
              <Link href={`/inbox?c=${active.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><MessageSquare className="size-4" /> Open live chat</Link>
            </div>
          </> : <div className="p-8 text-center text-sm text-muted-foreground">Select a conversation.</div>}
        </aside>
      </div>
    </div>
  );
}
