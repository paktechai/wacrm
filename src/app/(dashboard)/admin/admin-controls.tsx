"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type AdminPlanOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_public: boolean;
};

export function AccountAdminControls({
  accountId,
  lifecycleStatus,
  planId,
  subscriptionStatus,
  plans,
  canChangeLifecycle,
}: {
  accountId: string;
  lifecycleStatus: string;
  planId: string | null;
  subscriptionStatus: string;
  plans: AdminPlanOption[];
  canChangeLifecycle: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lifecycle, setLifecycle] = useState(lifecycleStatus);
  const [selectedPlanId, setSelectedPlanId] = useState(planId ?? "");
  const [subscription, setSubscription] = useState(subscriptionStatus);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setMessage(null);
    const payload: Record<string, string | null> = {
      planId: selectedPlanId || null,
      subscriptionStatus: subscription,
    };
    if (canChangeLifecycle) payload.lifecycleStatus = lifecycle;

    const response = await fetch(`/api/platform/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Update failed");
      return;
    }

    setMessage("Saved");
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex min-w-[430px] items-center gap-2">
      {canChangeLifecycle ? (
        <select
          value={lifecycle}
          onChange={(event) => setLifecycle(event.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
          aria-label="Account lifecycle"
        >
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ) : null}

      <select
        value={selectedPlanId}
        onChange={(event) => setSelectedPlanId(event.target.value)}
        className="h-9 min-w-32 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
        aria-label="Subscription plan"
      >
        <option value="">No plan</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}{plan.is_active ? "" : " (inactive)"}
          </option>
        ))}
      </select>

      <select
        value={subscription}
        onChange={(event) => setSubscription(event.target.value)}
        className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
        aria-label="Subscription status"
      >
        <option value="trialing">Trialing</option>
        <option value="active">Active</option>
        <option value="past_due">Past due</option>
        <option value="paused">Paused</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {message ? (
        <span className={message === "Saved" ? "text-[10px] text-emerald-400" : "max-w-40 text-[10px] text-destructive"}>
          {message}
        </span>
      ) : null}
    </div>
  );
}

export function CreatePlanForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/platform/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        code,
        description,
        isPublic: false,
        isActive: true,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Could not create plan");
      return;
    }

    setName("");
    setCode("");
    setDescription("");
    setMessage("Plan created");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={createPlan} className="grid gap-3 lg:grid-cols-[1fr_0.7fr_1.5fr_auto]">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Plan name"
        maxLength={80}
        required
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />
      <input
        value={code}
        onChange={(event) => setCode(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
        placeholder="plan-code"
        maxLength={64}
        required
        className="h-10 rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Short description (optional)"
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create plan"}
      </button>
      {message ? (
        <p className={message === "Plan created" ? "text-xs text-emerald-400 lg:col-span-4" : "text-xs text-destructive lg:col-span-4"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function PlanVisibilityControls({ plan }: { plan: AdminPlanOption }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function patch(changes: { isActive?: boolean; isPublic?: boolean }) {
    setMessage(null);
    const response = await fetch(`/api/platform/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Update failed");
      return;
    }
    setMessage("Saved");
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => patch({ isActive: !plan.is_active })}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-semibold text-foreground disabled:opacity-50"
      >
        {plan.is_active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => patch({ isPublic: !plan.is_public })}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-semibold text-foreground disabled:opacity-50"
      >
        {plan.is_public ? "Make private" : "Make public"}
      </button>
      {message ? <span className="text-[10px] text-muted-foreground">{message}</span> : null}
    </div>
  );
}
