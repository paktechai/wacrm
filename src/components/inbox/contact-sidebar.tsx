"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock3,
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  Sparkles,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import {
  calculateRelationshipPulse,
  chooseExplainableRelationshipAction,
  type RelationshipCommitmentSummary,
  type RelationshipRecommendationSummary,
  type RelationshipSignalSummary,
} from "@/lib/relationship-intelligence";

interface ContactSidebarProps {
  contact: Contact | null;
}

interface MemoryRow {
  id: string;
  memory_type: string;
  summary: string;
  confidence: number;
  observed_at: string;
}

interface CommitmentRow {
  id: string;
  title: string;
  commitment_direction: string;
  due_at: string | null;
  status: string;
  confidence: number;
}

interface SignalRow {
  id: string;
  signal_type: string;
  summary: string;
  severity: string;
  score: number | null;
  status: string;
  confidence: number;
}

interface RecommendationRow {
  id: string;
  title: string;
  rationale: string;
  urgency: "low" | "normal" | "high" | "urgent";
  policy_status: "allowed" | "review" | "blocked";
  requires_approval: boolean;
  status: string;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [commitments, setCommitments] = useState<CommitmentRow[]>([]);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [relationshipLinks, setRelationshipLinks] = useState(0);
  const [intelligenceNow, setIntelligenceNow] = useState(0);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    const [
      dealsRes,
      notesRes,
      tagsRes,
      memoriesRes,
      commitmentsRes,
      signalsRes,
      recommendationsRes,
      linksRes,
    ] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      supabase
        .from("relationship_memory_entries")
        .select("id, memory_type, summary, confidence, observed_at")
        .eq("contact_id", contact.id)
        .eq("state", "active")
        .order("observed_at", { ascending: false })
        .limit(5),
      supabase
        .from("relationship_commitments")
        .select("id, title, commitment_direction, due_at, status, confidence")
        .eq("contact_id", contact.id)
        .eq("status", "open")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(5),
      supabase
        .from("relationship_signals")
        .select("id, signal_type, summary, severity, score, status, confidence")
        .eq("contact_id", contact.id)
        .eq("status", "active")
        .order("observed_at", { ascending: false })
        .limit(5),
      supabase
        .from("relationship_recommendations")
        .select("id, title, rationale, urgency, policy_status, requires_approval, status")
        .eq("contact_id", contact.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("relationship_links")
        .select("id", { count: "exact", head: true })
        .or(`source_contact_id.eq.${contact.id},target_contact_id.eq.${contact.id}`)
        .eq("status", "active"),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }

    // Relationship OS tables are deliberately best-effort during rollout.
    // A migration that has not reached an environment yet must not break Inbox.
    setMemories(memoriesRes.error ? [] : ((memoriesRes.data ?? []) as MemoryRow[]));
    setCommitments(
      commitmentsRes.error ? [] : ((commitmentsRes.data ?? []) as CommitmentRow[]),
    );
    setSignals(signalsRes.error ? [] : ((signalsRes.data ?? []) as SignalRow[]));
    setRecommendations(
      recommendationsRes.error
        ? []
        : ((recommendationsRes.data ?? []) as RecommendationRow[]),
    );
    setRelationshipLinks(linksRes.error ? 0 : (linksRes.count ?? 0));
    // Capture the reference time as part of this async data refresh rather
    // than calling Date.now() during render (React render must stay pure).
    setIntelligenceNow(Date.now());
  }, [contact]);

  useEffect(() => {
    // This effect intentionally synchronizes the selected contact prop with
    // external Supabase state. Updates occur after the async fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim() || !accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="flex h-full w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">
          {tThread("selectConversation")}
        </p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();
  const activeDeals = deals.filter(
    (deal) => deal.status !== "lost" && deal.status !== "won",
  );

  // This is intentionally a transparent CRM-context completeness signal,
  // not a black-box model score. It tells an agent how much useful context
  // Wova8 has before the next interaction.
  const contextScore = Math.min(
    100,
    20 +
      (contact.name ? 10 : 0) +
      (contact.email ? 10 : 0) +
      (contact.company ? 10 : 0) +
      Math.min(tags.length * 5, 15) +
      Math.min(notes.length * 5, 15) +
      Math.min(memories.length * 5, 15) +
      Math.min(activeDeals.length * 10, 20),
  );

  const relationshipType =
    tags[0]?.name ?? (contact.company ? "Organization-linked" : "Unclassified");

  const fallbackAction =
    notes.length === 0 && memories.length === 0
      ? "Capture durable relationship context before the next follow-up."
      : activeDeals.length > 0
        ? "Review the active opportunity, promises and recent context before replying."
        : tags.length === 0
          ? "Classify this relationship so future automation can be more precise."
          : "Continue the conversation using the saved relationship context.";

  const commitmentSummaries: RelationshipCommitmentSummary[] = commitments.map(
    (commitment) => ({
      title: commitment.title,
      dueAt: commitment.due_at,
      status: commitment.status,
      direction: commitment.commitment_direction,
    }),
  );
  const signalSummaries: RelationshipSignalSummary[] = signals.map((signal) => ({
    type: signal.signal_type,
    summary: signal.summary,
    severity: signal.severity,
    score: signal.score,
    status: signal.status,
  }));
  const recommendationSummaries: RelationshipRecommendationSummary[] =
    recommendations.map((recommendation) => ({
      title: recommendation.title,
      rationale: recommendation.rationale,
      urgency: recommendation.urgency,
      policyStatus: recommendation.policy_status,
      requiresApproval: recommendation.requires_approval,
      status: recommendation.status,
    }));

  const explainableAction = chooseExplainableRelationshipAction({
    recommendations: recommendationSummaries,
    commitments: commitmentSummaries,
    signals: signalSummaries,
    fallback: fallbackAction,
  });

  const lastEngagedAt = (
    contact as Contact & { last_engaged_at?: string | null }
  ).last_engaged_at;
  const pulse = calculateRelationshipPulse({
    contextCompleteness: contextScore,
    commitments: commitmentSummaries,
    signals: signalSummaries,
    lastEngagedAt,
  });

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Relationship Intelligence
              </p>
              <p className="text-[10px] text-muted-foreground">
                Live brief for the current conversation
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center rounded-xl border border-border bg-background/40 p-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {relationshipType}
              </span>
              {relationshipLinks > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Link2 className="h-2.5 w-2.5" />
                  {relationshipLinks} network link{relationshipLinks === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  Relationship pulse
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {pulse.score}/100
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pulse.score}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-medium uppercase tracking-wide">{pulse.band.replace("_", " ")}</span>
              <span>Context {contextScore}/100</span>
            </div>
            {pulse.reasons.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {pulse.reasons.map((reason) => (
                  <p key={reason} className="text-[10px] leading-relaxed text-muted-foreground">
                    • {reason}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
              <SignalStat label="Memory" value={memories.length} />
              <SignalStat label="Promises" value={commitments.length} />
              <SignalStat label="Signals" value={signals.length} />
              <SignalStat label="Deals" value={activeDeals.length} />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Next best action
              </div>
              <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                {explainableAction.urgency}
              </span>
            </div>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-foreground">
              {explainableAction.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {explainableAction.reason}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-primary/10 pt-2 text-[10px] text-muted-foreground">
              <span>Why: {explainableAction.source}</span>
              {explainableAction.requiresApproval ? <span>Approval required</span> : null}
            </div>
          </div>

          {commitments.length > 0 ? (
            <IntelligenceSection
              icon={<Clock3 className="h-3 w-3" />}
              title="Commitment Radar"
            >
              {commitments.slice(0, 3).map((commitment) => {
                const overdue =
                  Boolean(commitment.due_at) &&
                  intelligenceNow > 0 &&
                  new Date(commitment.due_at as string).getTime() < intelligenceNow;
                return (
                  <div key={commitment.id} className="rounded-lg bg-muted px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{commitment.title}</p>
                      {overdue ? (
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {commitment.commitment_direction.replaceAll("_", " ")}
                      {commitment.due_at
                        ? ` · ${overdue ? "overdue" : "due"} ${format(new Date(commitment.due_at), "MMM d")}`
                        : " · no due date"}
                    </p>
                  </div>
                );
              })}
            </IntelligenceSection>
          ) : null}

          {signals.length > 0 ? (
            <IntelligenceSection
              icon={<Activity className="h-3 w-3" />}
              title="Live Signals"
            >
              {signals.slice(0, 3).map((signal) => (
                <div key={signal.id} className="rounded-lg bg-muted px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {signal.severity}
                    </span>
                    <span className="text-[9px] text-muted-foreground">·</span>
                    <span className="truncate text-[9px] text-muted-foreground">
                      {signal.signal_type.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-foreground">{signal.summary}</p>
                </div>
              ))}
            </IntelligenceSection>
          ) : null}

          {memories.length > 0 ? (
            <IntelligenceSection
              icon={<Brain className="h-3 w-3" />}
              title="Durable Memory"
            >
              {memories.slice(0, 3).map((memory) => (
                <div key={memory.id} className="rounded-lg bg-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {memory.memory_type}
                    </span>
                    {memory.confidence < 0.95 ? (
                      <span className="text-[9px] text-muted-foreground">
                        {Math.round(memory.confidence * 100)}% confidence
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-foreground">{memory.summary}</p>
                </div>
              ))}
            </IntelligenceSection>
          ) : null}

          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          <div className="my-4 border-t border-border" />

          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <TagIcon className="h-3 w-3" />
              {tSidebar("tags")}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  {tSidebar("noTags")}
                </p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {tSidebar("deals")}
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  {tSidebar("noDeals")}
                </p>
              ) : (
                deals.map((deal) => (
                  <div key={deal.id} className="rounded-lg bg-muted px-3 py-2">
                    <p className="text-sm font-medium text-foreground">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              {tSidebar("notes")}
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={tSidebar("addNotePlaceholder")}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg bg-muted px-3 py-2">
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function IntelligenceSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function SignalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/70 px-1 py-2">
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[8px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
