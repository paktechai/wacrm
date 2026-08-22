"use client";

import { useMemo, useState } from "react";
import { AlarmClock, BrainCircuit, Flag, MoonStar } from "lucide-react";
import { toast } from "sonner";

import type { Conversation } from "@/types";

type ModernConversation = Conversation & {
  priority?: "low" | "normal" | "high" | "urgent";
  snoozed_until?: string | null;
  first_response_due_at?: string | null;
  resolution_due_at?: string | null;
  customer_sentiment?: "positive" | "neutral" | "negative" | "unknown";
  detected_intent?: string | null;
  ai_summary?: string | null;
  next_action?: string | null;
};

type Patch = Partial<ModernConversation>;

export function ConversationIntelligenceBar({
  conversation,
  onChanged,
}: {
  conversation: Conversation | null;
  onChanged: (patch: Patch) => void;
}) {
  const conv = conversation as ModernConversation | null;
  const [saving, setSaving] = useState(false);

  const sla = useMemo(() => {
    if (!conv) return null;
    const due = conv.first_response_due_at ?? conv.resolution_due_at;
    if (!due) return null;
    const ms = new Date(due).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    if (ms <= 0) return { label: "SLA overdue", overdue: true };
    const mins = Math.ceil(ms / 60000);
    if (mins < 60) return { label: `${mins}m SLA`, overdue: false };
    return { label: `${Math.ceil(mins / 60)}h SLA`, overdue: false };
  }, [conv]);

  if (!conv) return null;
  const conversationId = conv.id;

  async function patch(body: Record<string, unknown>, optimistic: Patch) {
    if (saving) return;
    setSaving(true);
    onChanged(optimistic);
    try {
      const response = await fetch(`/api/inbox/conversations/${conversationId}/ops`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      if (payload?.conversation) onChanged(payload.conversation as Patch);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update conversation");
    } finally {
      setSaving(false);
    }
  }

  const priority = conv.priority ?? "normal";
  const sentiment = conv.customer_sentiment ?? "unknown";

  return (
    <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/70 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
        <Flag className="size-3.5 text-muted-foreground" />
        <select
          aria-label="Conversation priority"
          value={priority}
          disabled={saving}
          onChange={(event) =>
            patch(
              { priority: event.target.value },
              { priority: event.target.value as ModernConversation["priority"] },
            )
          }
          className="bg-transparent text-xs font-medium text-foreground outline-none"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => {
          const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          void patch({ snoozedUntil: until }, { snoozed_until: until });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
      >
        <MoonStar className="size-3.5" />
        Snooze 1h
      </button>

      {conv.snoozed_until ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void patch({ snoozedUntil: null }, { snoozed_until: null })}
          className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300"
        >
          Unsnooze
        </button>
      ) : null}

      {sla ? (
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
            sla.overdue
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-border bg-background text-muted-foreground",
          ].join(" ")}
        >
          <AlarmClock className="size-3.5" />
          {sla.label}
        </span>
      ) : null}

      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
        <BrainCircuit className="size-3.5" />
        {sentiment === "unknown" ? "AI insight pending" : sentiment}
        {conv.detected_intent ? ` · ${conv.detected_intent}` : ""}
      </span>

      {conv.next_action ? (
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={conv.next_action}>
          Next: {conv.next_action}
        </span>
      ) : null}
    </div>
  );
}
