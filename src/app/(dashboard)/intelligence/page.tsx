"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  MessageSquare,
  Sparkles,
  Users,
  Zap,
  ArrowRight,
  Radio,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SkeletonCard } from "@/components/dashboard/skeleton";

interface IntelligenceSnapshot {
  relationships: number;
  activeConversations: number;
  unassignedConversations: number;
  aiHandoffs: number;
  activeAutomations: number;
  openOpportunities: number;
  recentCampaignRecipients: number;
  recentCampaignDelivered: number;
  recentCampaignRead: number;
}

const EMPTY_SNAPSHOT: IntelligenceSnapshot = {
  relationships: 0,
  activeConversations: 0,
  unassignedConversations: 0,
  aiHandoffs: 0,
  activeAutomations: 0,
  openOpportunities: 0,
  recentCampaignRecipients: 0,
  recentCampaignDelivered: 0,
  recentCampaignRead: 0,
};

export default function IntelligencePage() {
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const db = createClient();

    try {
      const [
        relationshipsRes,
        activeConversationsRes,
        unassignedRes,
        handoffsRes,
        automationsRes,
        dealsRes,
        campaignsRes,
      ] = await Promise.all([
        db.from("contacts").select("id", { count: "exact", head: true }),
        db
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed"),
        db
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed")
          .is("assigned_agent_id", null),
        db
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed")
          .eq("ai_autoreply_disabled", true),
        db
          .from("automations")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        db
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        db
          .from("broadcasts")
          .select("total_recipients, delivered_count, read_count")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const firstError = [
        relationshipsRes.error,
        activeConversationsRes.error,
        unassignedRes.error,
        handoffsRes.error,
        automationsRes.error,
        dealsRes.error,
        campaignsRes.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const campaignRows = campaignsRes.data ?? [];
      setSnapshot({
        relationships: relationshipsRes.count ?? 0,
        activeConversations: activeConversationsRes.count ?? 0,
        unassignedConversations: unassignedRes.count ?? 0,
        aiHandoffs: handoffsRes.count ?? 0,
        activeAutomations: automationsRes.count ?? 0,
        openOpportunities: dealsRes.count ?? 0,
        recentCampaignRecipients: campaignRows.reduce(
          (sum, row) => sum + (row.total_recipients ?? 0),
          0,
        ),
        recentCampaignDelivered: campaignRows.reduce(
          (sum, row) => sum + (row.delivered_count ?? 0),
          0,
        ),
        recentCampaignRead: campaignRows.reduce(
          (sum, row) => sum + (row.read_count ?? 0),
          0,
        ),
      });
    } catch (err) {
      console.error("[intelligence] snapshot failed:", err);
      setError("Relationship intelligence could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const readRate =
    snapshot.recentCampaignDelivered > 0
      ? Math.round(
          (snapshot.recentCampaignRead / snapshot.recentCampaignDelivered) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Relationship Intelligence
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            One operational view of relationship context, conversations, AI
            handoffs, campaigns and automation. The goal is not more charts —
            it is knowing what deserves attention next.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:self-auto"
        >
          Refresh intelligence
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))
        ) : (
          <>
            <MetricCard
              title="Relationships"
              value={snapshot.relationships.toLocaleString()}
              icon={Users}
              subtitle="People and organizations in relationship memory"
            />
            <MetricCard
              title="Active conversations"
              value={snapshot.activeConversations.toLocaleString()}
              icon={MessageSquare}
              subtitle={`${snapshot.unassignedConversations.toLocaleString()} currently unassigned`}
            />
            <MetricCard
              title="AI handoffs"
              value={snapshot.aiHandoffs.toLocaleString()}
              icon={Bot}
              subtitle="Open conversations where AI is paused for a human"
            />
            <MetricCard
              title="Active automations"
              value={snapshot.activeAutomations.toLocaleString()}
              icon={Zap}
              subtitle={`${snapshot.openOpportunities.toLocaleString()} open relationship opportunities`}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Next-best-action queue
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Deterministic signals first; AI assists where context is useful.
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-4 space-y-2">
            <ActionRow
              href="/inbox"
              title="Review unassigned conversations"
              detail={`${snapshot.unassignedConversations} active conversation${snapshot.unassignedConversations === 1 ? "" : "s"} need ownership.`}
              priority={snapshot.unassignedConversations > 0 ? "Attention" : "Clear"}
            />
            <ActionRow
              href="/inbox"
              title="Review AI-to-human handoffs"
              detail={`${snapshot.aiHandoffs} open conversation${snapshot.aiHandoffs === 1 ? "" : "s"} have AI paused.`}
              priority={snapshot.aiHandoffs > 0 ? "Attention" : "Clear"}
            />
            <ActionRow
              href="/contacts"
              title="Enrich relationship memory"
              detail="Use tags, notes, organization context and opportunities so future replies and automations are more relevant."
              priority="Ongoing"
            />
            <ActionRow
              href="/automations"
              title="Move repeated work into automation"
              detail={`${snapshot.activeAutomations} automation${snapshot.activeAutomations === 1 ? " is" : "s are"} active now; keep human judgment for exceptions.`}
              priority="Optimize"
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Campaign intelligence
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Aggregate delivery quality across the 20 most recent campaigns.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniMetric
              label="Recipients"
              value={snapshot.recentCampaignRecipients.toLocaleString()}
            />
            <MiniMetric
              label="Delivered"
              value={snapshot.recentCampaignDelivered.toLocaleString()}
            />
            <MiniMetric label="Read rate" value={`${readRate}%`} />
          </div>

          <Link
            href="/broadcasts"
            className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Open Campaigns
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>
      </div>

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Wova8 AI operating model
          </h2>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          AI is a decision layer, not a single point of failure. Current drafts
          and auto-replies are now grounded in bounded relationship context as
          well as recent conversation history and approved knowledge.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <OperatingStep number="01" title="Relationship context" detail="Identity, tags, opportunities, recent notes" />
          <OperatingStep number="02" title="Conversation context" detail="Recent messages and current intent" />
          <OperatingStep number="03" title="Approved knowledge" detail="Business rules, policies and reference content" />
          <OperatingStep number="04" title="Reply or handoff" detail="AI answers when grounded; humans own uncertainty" />
        </div>
      </section>
    </div>
  );
}

function ActionRow({
  href,
  title,
  detail,
  priority,
}: {
  href: string;
  title: string;
  detail: string;
  priority: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 transition-colors hover:bg-muted/70"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {priority}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function OperatingStep({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-primary/10 bg-background/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
        {number}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
