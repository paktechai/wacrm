"use client";

import { FormEvent, useEffect, useState } from "react";
import { BrainCircuit, Languages, ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type ConversationOption = {
  id: string;
  last_message_text: string | null;
  contact: { name?: string | null; phone?: string | null } | null;
};

type CopilotAction = "summary" | "analyze" | "next_action";

export function CopilotWorkbench() {
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [text, setText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Urdu");

  useEffect(() => {
    const db = createClient();
    void db
      .from("conversations")
      .select("id, last_message_text, contact:contacts(name,phone)")
      .order("last_message_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) {
          console.error("[copilot] conversation list failed", error);
          return;
        }
        const rows = (data ?? []).map((row) => ({
          id: row.id as string,
          last_message_text: (row.last_message_text as string | null) ?? null,
          contact: Array.isArray(row.contact)
            ? ((row.contact[0] as ConversationOption["contact"]) ?? null)
            : ((row.contact as ConversationOption["contact"]) ?? null),
        }));
        setConversations(rows);
        if (rows[0]) setConversationId(rows[0].id);
      });
  }, []);

  async function run(action: CopilotAction) {
    if (!conversationId || running) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, conversationId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Copilot request failed");
      setResult(payload.result);
      toast.success(`Copilot ${action.replace("_", " ")} complete`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copilot request failed");
    } finally {
      setRunning(false);
    }
  }

  async function transform(event: FormEvent<HTMLFormElement>, action: "rewrite" | "translate") {
    event.preventDefault();
    if (!text.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, input: text, targetLanguage }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Copilot request failed");
      setResult(payload.result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copilot request failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><BrainCircuit className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Conversation intelligence</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Summarize a thread, detect intent/sentiment, update lead score, and recommend the next action.</p>
        <select value={conversationId} onChange={(event) => setConversationId(event.target.value)} className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
          {conversations.map((item) => (
            <option key={item.id} value={item.id}>
              {(item.contact?.name || item.contact?.phone || "Unknown contact").slice(0, 40)} — {(item.last_message_text || "No message").slice(0, 60)}
            </option>
          ))}
        </select>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button disabled={!conversationId || running} onClick={() => void run("summary")} className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"><Sparkles className="mr-1 inline size-4" /> Summary</button>
          <button disabled={!conversationId || running} onClick={() => void run("analyze")} className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"><BrainCircuit className="mr-1 inline size-4" /> Analyze</button>
          <button disabled={!conversationId || running} onClick={() => void run("next_action")} className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"><ListChecks className="mr-1 inline size-4" /> Next action</button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><Languages className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Rewrite & translate</h2></div>
        <form onSubmit={(event) => void transform(event, "rewrite")} className="mt-4 space-y-3">
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder="Paste a draft reply here…" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary" />
          <div className="flex gap-2">
            <input value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} placeholder="Target language" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <button type="button" disabled={!text.trim() || running} onClick={(event) => void transform({ preventDefault: () => undefined } as FormEvent<HTMLFormElement>, "translate")} className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">Translate</button>
            <button disabled={!text.trim() || running} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Rewrite</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5 xl:col-span-2">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Copilot result</h2>{running ? <RefreshCw className="size-4 animate-spin text-primary" /> : null}</div>
        <pre className="mt-3 min-h-24 whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-4 text-sm leading-6 text-foreground">{result === null ? "Run a Copilot action to see the result." : typeof result === "string" ? result : JSON.stringify(result, null, 2)}</pre>
      </section>
    </div>
  );
}
