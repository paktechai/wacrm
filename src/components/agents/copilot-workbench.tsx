'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  Languages,
  ListChecks,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  createTransformRequest,
  parseServerTiming,
  requestCopilot,
  runSingleCopilotAction,
  type CopilotAction,
  type CopilotRequestBody,
  type CopilotRequestResult,
} from '@/lib/ai/copilot-client';

type ConversationOption = {
  id: string;
  last_message_text: string | null;
  contact: { name?: string | null; phone?: string | null } | null;
};

const ACTION_LABELS: Record<CopilotAction, string> = {
  summary: 'Summary',
  analyze: 'Analyze',
  next_action: 'Next action',
  rewrite: 'Rewrite',
  translate: 'Translate',
};

type LatencyResult = {
  totalMs: number;
  providerMs: number | null;
  appMs: number | null;
};

export function CopilotWorkbench() {
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [activeAction, setActiveAction] = useState<CopilotAction | null>(null);
  const [latencies, setLatencies] = useState<
    Partial<Record<CopilotAction, LatencyResult>>
  >({});
  const [text, setText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('Urdu');
  const actionLock = useRef(false);

  useEffect(() => {
    const db = createClient();
    void db
      .from('conversations')
      .select('id, last_message_text, contact:contacts(name,phone)')
      .order('last_message_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) {
          console.error('[copilot] conversation list failed', error);
          return;
        }
        const rows = (data ?? []).map((row) => ({
          id: row.id as string,
          last_message_text: (row.last_message_text as string | null) ?? null,
          contact: Array.isArray(row.contact)
            ? ((row.contact[0] as ConversationOption['contact']) ?? null)
            : ((row.contact as ConversationOption['contact']) ?? null),
        }));
        setConversations(rows);
        if (rows[0]) setConversationId(rows[0].id);
      });
  }, []);

  function recordSuccess(
    action: CopilotAction,
    response: CopilotRequestResult
  ) {
    const server = parseServerTiming(response.serverTiming);
    const providerMs = Number.isFinite(server.provider)
      ? server.provider
      : null;
    const serverTotalMs = Number.isFinite(server.total) ? server.total : null;
    setResult(response.result);
    setLatencies((current) => ({
      ...current,
      [action]: {
        totalMs: response.totalMs,
        providerMs,
        appMs:
          providerMs !== null && serverTotalMs !== null
            ? Math.max(0, serverTotalMs - providerMs)
            : null,
      },
    }));
  }

  async function execute(action: CopilotAction, body: CopilotRequestBody) {
    if (actionLock.current) return;
    setResult(null);
    try {
      await runSingleCopilotAction({
        lock: actionLock,
        setPending: (pending) => setActiveAction(pending ? action : null),
        request: () => requestCopilot(body),
        onSuccess: (response) => recordSuccess(action, response),
      });
      toast.success(`Copilot ${action.replace('_', ' ')} complete`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Copilot request failed'
      );
    }
  }

  function run(action: 'summary' | 'analyze' | 'next_action') {
    if (!conversationId) return;
    return execute(action, { action, conversationId });
  }

  function transform(action: 'rewrite' | 'translate') {
    if (!text.trim()) return;
    return execute(
      action,
      createTransformRequest(action, text, targetLanguage)
    );
  }

  const running = activeAction !== null;

  function actionContent(action: CopilotAction, icon?: React.ReactNode) {
    return activeAction === action ? (
      <>
        <Loader2 className="mr-1 inline size-4 animate-spin" />
        {ACTION_LABELS[action]}…
      </>
    ) : (
      <>
        {icon}
        {ACTION_LABELS[action]}
      </>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="border-border bg-card rounded-2xl border p-5">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-primary size-4" />
          <h2 className="text-foreground font-semibold">
            Conversation intelligence
          </h2>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Summarize a thread, detect intent/sentiment, update lead score, and
          recommend the next action.
        </p>
        <select
          value={conversationId}
          onChange={(event) => setConversationId(event.target.value)}
          className="border-border bg-background focus:border-primary mt-4 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
        >
          {conversations.map((item) => (
            <option key={item.id} value={item.id}>
              {(
                item.contact?.name ||
                item.contact?.phone ||
                'Unknown contact'
              ).slice(0, 40)}{' '}
              — {(item.last_message_text || 'No message').slice(0, 60)}
            </option>
          ))}
        </select>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            aria-busy={activeAction === 'summary'}
            disabled={!conversationId || running}
            onClick={() => void run('summary')}
            className="border-border hover:bg-muted rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          >
            {actionContent(
              'summary',
              <Sparkles className="mr-1 inline size-4" />
            )}
          </button>
          <button
            aria-busy={activeAction === 'analyze'}
            disabled={!conversationId || running}
            onClick={() => void run('analyze')}
            className="border-border hover:bg-muted rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          >
            {actionContent(
              'analyze',
              <BrainCircuit className="mr-1 inline size-4" />
            )}
          </button>
          <button
            aria-busy={activeAction === 'next_action'}
            disabled={!conversationId || running}
            onClick={() => void run('next_action')}
            className="border-border hover:bg-muted rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          >
            {actionContent(
              'next_action',
              <ListChecks className="mr-1 inline size-4" />
            )}
          </button>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5">
        <div className="flex items-center gap-2">
          <Languages className="text-primary size-4" />
          <h2 className="text-foreground font-semibold">Rewrite & translate</h2>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void transform('rewrite');
          }}
          className="mt-4 space-y-3"
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={7}
            placeholder="Paste a draft reply here…"
            className="border-border bg-background focus:border-primary w-full rounded-xl border px-3 py-2.5 text-sm leading-6 outline-none"
          />
          <div className="flex gap-2">
            <input
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              placeholder="Target language"
              className="border-border bg-background focus:border-primary min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              aria-busy={activeAction === 'translate'}
              disabled={!text.trim() || !targetLanguage.trim() || running}
              onClick={() => void transform('translate')}
              className="border-border hover:bg-muted rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
            >
              {actionContent('translate')}
            </button>
            <button
              aria-busy={activeAction === 'rewrite'}
              disabled={!text.trim() || !targetLanguage.trim() || running}
              className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {actionContent('rewrite')}
            </button>
          </div>
        </form>
      </section>

      <section className="border-border bg-background rounded-2xl border p-5 xl:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">
            Copilot result
          </h2>
          {running ? (
            <span className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="text-primary size-4 animate-spin" />
              Running {ACTION_LABELS[activeAction]}…
            </span>
          ) : null}
        </div>
        <pre className="border-border bg-card text-foreground mt-3 min-h-24 rounded-xl border p-4 text-sm leading-6 break-words whitespace-pre-wrap">
          {result === null
            ? running
              ? `Running ${ACTION_LABELS[activeAction]}…`
              : 'Run a Copilot action to see the result.'
            : typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2)}
        </pre>
        {Object.keys(latencies).length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="text-muted-foreground w-full text-left text-xs">
              <thead>
                <tr className="border-border border-b">
                  <th className="py-2 font-medium">Action</th>
                  <th className="py-2 font-medium">End-to-end</th>
                  <th className="py-2 font-medium">Provider</th>
                  <th className="py-2 font-medium">App/API/DB</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(ACTION_LABELS) as CopilotAction[]).map(
                  (action) => {
                    const latency = latencies[action];
                    if (!latency) return null;
                    return (
                      <tr key={action} className="border-border/60 border-b">
                        <td className="text-foreground py-2">
                          {ACTION_LABELS[action]}
                        </td>
                        <td className="py-2">
                          {(latency.totalMs / 1000).toFixed(2)}s
                        </td>
                        <td className="py-2">
                          {latency.providerMs === null
                            ? '—'
                            : `${(latency.providerMs / 1000).toFixed(2)}s`}
                        </td>
                        <td className="py-2">
                          {latency.appMs === null
                            ? '—'
                            : `${(latency.appMs / 1000).toFixed(2)}s`}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
