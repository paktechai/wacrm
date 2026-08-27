export type CopilotAction =
  'summary' | 'analyze' | 'next_action' | 'rewrite' | 'translate';

export type CopilotRequestBody = {
  action: CopilotAction;
  conversationId?: string;
  input?: string;
  targetLanguage?: string;
};

export type CopilotRequestResult = {
  result: unknown;
  totalMs: number;
  serverTiming: string;
};

export type CopilotActionLock = { current: boolean };

export function createTransformRequest(
  action: 'rewrite' | 'translate',
  input: string,
  targetLanguage: string
): CopilotRequestBody {
  return { action, input, targetLanguage };
}

export function parseServerTiming(value: string): Record<string, number> {
  const timings: Record<string, number> = {};
  for (const item of value.split(',')) {
    const match = item.trim().match(/^([a-z_]+);dur=(\d+(?:\.\d+)?)$/i);
    if (match) timings[match[1]] = Number(match[2]);
  }
  return timings;
}

export async function requestCopilot(
  body: CopilotRequestBody,
  options: {
    fetcher?: typeof fetch;
    timeoutMs?: number;
    now?: () => number;
  } = {}
): Promise<CopilotRequestResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 35_000;
  const now = options.now ?? (() => performance.now());
  const startedAt = now();

  let response: Response;
  try {
    response = await fetcher('/api/ai/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new Error('Copilot request timed out. Please retry.');
    }
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || 'Copilot request failed');
  }

  return {
    result: payload.result,
    totalMs: now() - startedAt,
    serverTiming: response.headers.get('server-timing') ?? '',
  };
}

/** A synchronous lock closes the gap before React renders disabled buttons. */
export async function runSingleCopilotAction<T>({
  lock,
  setPending,
  request,
  onSuccess,
}: {
  lock: CopilotActionLock;
  setPending: (pending: boolean) => void;
  request: () => Promise<T>;
  onSuccess: (result: T) => void;
}): Promise<boolean> {
  if (lock.current) return false;
  lock.current = true;
  setPending(true);
  try {
    onSuccess(await request());
    return true;
  } finally {
    lock.current = false;
    setPending(false);
  }
}
