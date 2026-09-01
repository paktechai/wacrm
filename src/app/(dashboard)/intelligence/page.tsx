"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  Clock3,
  Link2,
  MessageSquare,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
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
  openCommitments: number;
  overdueCommitments: number;
  activeSignals: number;
  highRiskSignals: number;
  pendingRecommendations: number;
  memoryConflicts: number;
  stakeholderLinks: number;
  aiDecisionTraces: number;
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
  openCommitments: 0,
  overdueCommitments: 0,
  activeSignals: 0,
  highRiskSignals: 0,
  pendingRecommendations: 0,
  memoryConflicts: 0,
  stakeholderLinks: 0,
  aiDecisionTraces: 0,
};

export default function IntelligencePage() {
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relationshipOsAvailable, setRelationshipOsAvailable] = useState(false);

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

      const nowIso = new Date().toISOString();
      const [
        commitmentsRes,
        overdueCommitmentsRes,
        signalsRes,
        highRiskSignalsRes,
        recommendationsRes,
        memoryConflictsRes,
        linksRes,
        tracesRes,
      ] = await Promise.all([
        db
          .from("relationship_commitments")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        db
          .from("relationship_commitments")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .lt("due_at", nowIso),
        db
          .from("relationship_signals")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        db
          .from("relationship_signals")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .in("severity", ["high", "critical"]),
        db
          .from("relationship_recommendations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .neq("policy_status", "blocked"),
        db
          .from("relationship_memory_entries")
          .select("id", { count: "exact", head: true })
          .in("state", ["conflict", "stale"]),
        db
          .from("relationship_links")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        db
          .from("ai_decision_traces")
          .select("id", { count: "exact", head: true }),
      ]);

      const osResults = [
        commitmentsRes,
        overdueCommitmentsRes,
        signalsRes,
        highRiskSignalsRes,
        recommendationsRes,
        memoryConflictsRes,
        linksRes,
        tracesRes,
      ];
      const osAvailable = osResults.some((result) => !result.error);
      setRelationshipOsAvailable(osAvailable);

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
        openCommitments: commitmentsRes.error ? 0 : (commitmentsRes.count ?? 0),
        overdueCommitments: overdueCommitmentsRes.error
          ? 0
          : (overdueCommitmentsRes.count ?? 0),
        activeSignals: signalsRes.error ? 0 : (signalsRes.count ?? 0),
        highRiskSignals: highRiskSignalsRes.error
          ? 0
          : (highRiskSignalsRes.count ?? 0),
        pendingRecommendations: recommendationsRes.error
          ? 0
          : (recommendationsRes.count ?? 0),
        memoryConflicts: memoryConflictsRes.error ? 0 : (memoryConflictsRes.count ?? 0),
        stakeholderLinks: linksRes.error ? 0 : (linksRes.count ?? 0),
        aiDecisionTraces: tracesRes.error ? 0 : (tracesRes.count ?? 0),
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
            One operational view of relationship context, commitments, risk,
            opportunities, conversations and AI decisions. Every priority should
            answer one question: why does this relationship need attention now?
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
              title="Commitments due"
              value={snapshot.openCommitments.toLocaleString()}
              icon={Clock3}
              subtitle={`${snapshot.overdueCommitments.toLocaleString()} overdue promises need recovery`}
            />
            <MetricCard
              title="Relationship signals"
              value={snapshot.activeSignals.toLocaleString()}
              icon={AlertTriangle}
              subtitle={`${snapshot.highRiskSignals.toLocaleString()} high/critical signals`}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Explainable next-best-action queue
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Commitments and deterministic risk signals remain useful even if
                an AI provider is unavailable.
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-4 space-y-2">
            {relationshipOsAvailable ? (
              <>
                <ActionRow
                  href="/inbox"
                  title="Recover overdue commitments"
                  detail={`${snapshot.overdueCommitments} promise${snapshot.overdueCommitments === 1 ? " is" : "s are"} past due. Wova8 keeps who promised what and when visible beside the conversation.`}
                  priority={snapshot.overdueCommitments > 0 ? "Urgent" : "Clear"}
                />
                <ActionRow
                  href="/inbox"
                  title="Review relationship risk signals"
                  detail={`${snapshot.highRiskSignals} high/critical signal${snapshot.highRiskSignals === 1 ? "" : "s"} currently indicate decay, silence, negative sentiment or another configured risk.`}
                  priority={snapshot.highRiskSignals > 0 ? "Attention" : "Clear"}
                />
                <ActionRow
                  href="/inbox"
                  title="Act on evidence-backed recommendations"
                  detail={`${snapshot.pendingRecommendations} policy-permitted recommendation${snapshot.pendingRecommendations === 1 ? " is" : "s are"} waiting. Each can carry rationale, evidence, confidence and an approval gate.`}
                  priority={snapshot.pendingRecommendations > 0 ? "Ready" : "Clear"}
                />
                <ActionRow
                  href="/contacts"
                  title="Resolve stale or conflicting memory"
                  detail={`${snapshot.memoryConflicts} durable memory entr${snapshot.memoryConflicts === 1 ? "y is" : "ies are"} stale or conflicting instead of being silently treated as truth.`}
                  priority={snapshot.memoryConflicts > 0 ? "Review" : "Clear"}
                />
              </>
            ) : (
              <ActionRow
                href="/contacts"
                title="Relationship OS schema is not active in this environment"
                detail="Core Inbox and AI remain operational. Apply the Relationship OS migration before using durable memory, commitment radar, signals and explainable recommendations."
                priority="Setup"
              />
            )}
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
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Relationship OS coverage
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              A durable operational layer beyond messages and pipeline fields.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Stakeholder links" value={snapshot.stakeholderLinks.toLocaleString()} />
              <MiniMetric label="AI decision traces" value={snapshot.aiDecisionTraces.toLocaleString()} />
              <MiniMetric label="Open promises" value={snapshot.openCommitments.toLocaleString()} />
              <MiniMetric label="Pending actions" value={snapshot.pendingRecommendations.toLocaleString()} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Campaign intelligence
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Aggregate delivery quality across the 20 most recent campaigns.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
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
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Wova8 AI operating model
          </h2>
        </div>
        <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
          AI is a decision layer, not a single point of failure. Relationship OS
          adds durable memory, promise tracking and active signals to the bounded
          context already used by drafts and auto-replies. Provenance, confidence
          and policy gates keep intelligence inspectable rather than magical.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <OperatingStep
            number="01"
            title="Durable memory"
            detail="Facts, preferences, goals, validity and conflicts"
            icon={<Brain className="h-3.5 w-3.5" />}
          />
          <OperatingStep
            number="02"
            title="Commitments"
            detail="Who promised what, ownership, due date and status"
            icon={<Clock3 className="h-3.5 w-3.5" />}
          />
          <OperatingStep
            number="03"
            title="Signals"
            detail="Decay, revival, intent, sentiment and configured risks"
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
          />
          <OperatingStep
            number="04"
            title="Stakeholder graph"
            detail="Introducers, champions, blockers and influence paths"
            icon={<Link2 className="h-3.5 w-3.5" />}
          />
          <OperatingStep
            number="05"
            title="Policy gate"
            detail="Allowed, review or blocked before an action is taken"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
          />
          <OperatingStep
            number="06"
            title="Decision trace"
            detail="Why the AI/system chose an action and what it used"
            icon={<Zap className="h-3.5 w-3.5" />}
          />
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
  icon,
}: {
  number: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-primary/10 bg-background/50 p-3">
      <div className="flex items-center justify-between text-primary">
        <p className="text-[10px] font-semibold uppercase tracking-widest">
          {number}
        </p>
        {icon}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
