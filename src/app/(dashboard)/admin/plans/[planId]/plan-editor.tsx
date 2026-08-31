"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EditablePlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
};

const FEATURE_OPTIONS = [
  ["whatsapp_messaging", "WhatsApp messaging"],
  ["contacts", "Contacts"],
  ["pipelines", "Sales pipelines"],
  ["broadcasts", "Broadcast campaigns"],
  ["automations", "Automations"],
  ["flows", "Visual flows"],
  ["ai_assistant", "AI assistant"],
  ["api", "Public API"],
  ["team", "Team access"],
] as const;

const LIMIT_OPTIONS = [
  ["contacts", "Contacts"],
  ["team_members", "Team members"],
  ["messages_sent", "Messages sent / month"],
  ["broadcast_recipients", "Broadcast recipients / month"],
  ["ai_requests", "AI requests / month"],
  ["api_requests", "API requests / month"],
  ["whatsapp_numbers", "WhatsApp numbers"],
] as const;

export function PlanEditor({
  plan,
  canEdit,
}: {
  plan: EditablePlan;
  canEdit: boolean;
}) {
  const router = useRouter();
  const systemManaged = plan.code === "foundation";
  const editable = canEdit && !systemManaged;
  const [features, setFeatures] = useState<Record<string, boolean>>(() => ({
    ...Object.fromEntries(FEATURE_OPTIONS.map(([key]) => [key, false])),
    ...plan.features,
  }));
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      LIMIT_OPTIONS.map(([key]) => [
        key,
        plan.limits[key] === null || plan.limits[key] === undefined
          ? ""
          : String(plan.limits[key]),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);

  const parsedLimits = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const [key] of LIMIT_OPTIONS) {
      const raw = limits[key]?.trim() ?? "";
      if (!raw) {
        result[key] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value < 0) return null;
      result[key] = value;
    }
    return result;
  }, [limits]);

  async function save() {
    if (!editable) return;
    if (!parsedLimits) {
      toast.error("Limits must be whole numbers of zero or greater");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/platform/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features, limits: parsedLimits }),
      });
      const json = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(json?.error || "Could not update the plan");
      }
      toast.success("Plan entitlements updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {systemManaged ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-200">
          The Foundation plan is a system fallback. It stays private, active and uncapped so new workspaces remain usable until a commercial plan is assigned.
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Capabilities</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Server routes enforce these before WhatsApp, AI and other external side effects.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_OPTIONS.map(([key, label]) => {
            const enabled = features[key] === true;
            return (
              <button
                key={key}
                type="button"
                disabled={!editable}
                onClick={() =>
                  setFeatures((current) => ({ ...current, [key]: !enabled }))
                }
                className={[
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  enabled
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground",
                  editable ? "hover:border-primary/40" : "cursor-default opacity-80",
                ].join(" ")}
              >
                <span className="text-xs font-medium">{label}</span>
                <span
                  className={[
                    "flex size-5 items-center justify-center rounded-full border",
                    enabled
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  ].join(" ")}
                >
                  {enabled ? <Check className="size-3" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Usage limits</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Leave a value blank for unlimited. Contacts and team seats are enforced authoritatively in the database.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIMIT_OPTIONS.map(([key, label]) => (
            <label key={key} className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <Input
                type="number"
                min={0}
                step={1}
                disabled={!editable}
                value={limits[key] ?? ""}
                onChange={(event) =>
                  setLimits((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                placeholder="Unlimited"
                className="bg-background"
              />
            </label>
          ))}
        </div>
      </section>

      {editable ? (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || parsedLimits === null}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save entitlements
          </Button>
        </div>
      ) : null}
    </div>
  );
}
