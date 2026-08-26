export type SubmissionLock = { current: boolean };

type SingleAgentCreationOptions<T> = {
  lock: SubmissionLock;
  setPending: (pending: boolean) => void;
  request: () => Promise<T>;
  onCreated: (agent: T) => void;
  refresh: () => Promise<unknown>;
};

/**
 * Synchronous lock prevents a second submit before React commits the disabled
 * button state. List refresh deliberately runs in the background: the POST
 * response updates the visible list immediately, so refresh latency does not
 * keep the form blocked.
 */
export async function runSingleAgentCreation<T>({
  lock,
  setPending,
  request,
  onCreated,
  refresh,
}: SingleAgentCreationOptions<T>): Promise<boolean> {
  if (lock.current) return false;

  lock.current = true;
  setPending(true);
  try {
    const agent = await request();
    onCreated(agent);
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined);
    return true;
  } finally {
    lock.current = false;
    setPending(false);
  }
}
