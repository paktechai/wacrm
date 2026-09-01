"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Loader2, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/dashboard/skeleton";
import {
  cacheCreatedAgent,
  loadAgentProfiles,
  type AgentProfile,
} from "@/lib/ai/agent-profiles-client";
import { runSingleAgentCreation } from "@/lib/ai/create-agent-flow";

const PRESETS: Record<string, string> = {
  sales:
    "Qualify the lead, understand the customer's goal, answer accurately from approved knowledge, capture explicit buying signals and durable relationship context, keep agreed commitments visible, recommend the next best step, and hand off when pricing or commitments need human approval.",
  support:
    "Resolve customer questions accurately and calmly using approved knowledge. Preserve explicit preferences or commitments that matter to future service, ask only necessary clarifying questions, never invent policy, and hand off when confidence is low or a complaint needs a human.",
  receptionist:
    "Welcome customers, understand why they contacted the business, answer basic approved questions, collect required details, preserve useful explicit relationship context, schedule or route the request, and keep responses concise.",
  lead_qualifier:
    "Identify need, urgency, budget signals and decision readiness. Ask short qualification questions, update the CRM context, preserve explicit durable facts and agreed next steps, and route qualified leads to a human sales agent with a concise summary.",
  custom: "Follow the business instructions and approved knowledge. Preserve only explicit, useful relationship context and real commitments. Be concise, safe and transparent when a human is needed.",
};

export function AgentProfiles({
  accountId,
  onConfigurationMissing,
}: {
  accountId: string | null;
  onConfigurationMissing: () => void;
}) {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState("sales");
  const creationLockRef = useRef({ current: false });
  const loadSequenceRef = useRef(0);

  const load = useCallback(async ({ force = false, silent = false } = {}) => {
    if (!accountId) return;
    const sequence = ++loadSequenceRef.current;
    if (!silent) setLoading(true);
    try {
      const result = await loadAgentProfiles(accountId, { force });
      if (sequence !== loadSequenceRef.current) return;
      setAgents(result.agents);
      if (!result.configured) onConfigurationMissing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load AI agents");
    } finally {
      if (sequence === loadSequenceRef.current && !silent) setLoading(false);
    }
  }, [accountId, onConfigurationMissing]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await runSingleAgentCreation({
        lock: creationLockRef.current,
        setPending: setCreating,
        request: async () => {
          const response = await fetch("/api/ai/agents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.get("name"),
              agentType: type,
              systemPrompt: form.get("systemPrompt"),
              isDefault: form.get("defaultAgent") === "on",
              goals: ["answer", "qualify", "remember", "commit", "route", "handoff"],
              toolPolicy: {
                crm_context: true,
                knowledge_base: true,
                create_task: true,
                create_appointment: true,
                remember_relationship: true,
                record_commitment: true,
              },
              handoffPolicy: { low_confidence: true, complaint: true, human_request: true },
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload?.error || "Could not create AI agent");
          return payload.agent as AgentProfile;
        },
        onCreated: (agent) => {
          setAgents((current) => {
            const normalized = agent.is_default
              ? current.map((item) => ({ ...item, is_default: false }))
              : current;
            return [...normalized, agent];
          });
          cacheCreatedAgent(accountId, agent);
          formElement.reset();
          setType("sales");
          toast.success("AI agent created");
        },
        refresh: () => load({ force: true, silent: true }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create AI agent");
    }
  }

  async function setDefault(agent: AgentProfile) {
    const response = await fetch(`/api/ai/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true, isActive: true }),
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload?.error || "Could not update agent");
      return;
    }
    await load();
    toast.success(`${agent.name} is now the default agent`);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-semibold text-foreground">Autonomous agent profiles</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Create focused agents for sales, support, reception and qualification. Governed agents can preserve explicit relationship memory and real commitments after the reply slot is safely claimed; provider secrets stay in the existing BYO AI configuration.
          </p>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="space-y-3 p-5" aria-label="Loading agent profiles">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : agents.map((agent) => (
            <div key={agent.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="size-5" /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{agent.name}</span>
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{agent.agent_type.replace("_", " ")}</span>
                    {agent.is_default ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"><CheckCircle2 className="size-3" /> Default</span> : null}
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{agent.system_prompt || "No custom instructions yet."}</p>
                </div>
              </div>
              {!agent.is_default ? (
                <button type="button" onClick={() => void setDefault(agent)} className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Make default</button>
              ) : null}
            </div>
          ))}
          {!loading && agents.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No autonomous agents yet. Create the first one.</div> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Create agent</h2></div>
        <form onSubmit={createAgent} className="mt-4 space-y-3">
          <input name="name" required maxLength={80} placeholder="e.g. Sales Concierge" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <select value={type} onChange={(event) => setType(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
            <option value="sales">Sales agent</option><option value="support">Support agent</option><option value="receptionist">Receptionist</option><option value="lead_qualifier">Lead qualifier</option><option value="custom">Custom</option>
          </select>
          <textarea name="systemPrompt" rows={7} defaultValue={PRESETS[type]} key={type} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input name="defaultAgent" type="checkbox" /> Make this the default autonomous agent</label>
          <button
            type="submit"
            disabled={creating || !accountId}
            aria-busy={creating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {creating ? "Creating..." : "Create agent"}
          </button>
        </form>
      </section>
    </div>
  );
}
