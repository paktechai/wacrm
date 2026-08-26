import { describe, expect, it, vi } from 'vitest';
import { runSingleAgentCreation } from './create-agent-flow';

describe('single agent creation flow', () => {
  it('blocks repeated submissions while a slow request is pending', async () => {
    let resolveRequest!: (value: { id: string }) => void;
    const request = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveRequest = resolve;
        })
    );
    const lock = { current: false };
    const setPending = vi.fn();
    const onCreated = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const options = { lock, setPending, request, onCreated, refresh };

    const first = runSingleAgentCreation(options);
    const accidentalSecondClick = await runSingleAgentCreation(options);

    expect(accidentalSecondClick).toBe(false);
    expect(request).toHaveBeenCalledOnce();
    expect(setPending).toHaveBeenNthCalledWith(1, true);

    resolveRequest({ id: 'agent-1' });
    await expect(first).resolves.toBe(true);
    expect(onCreated).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(setPending).toHaveBeenLastCalledWith(false);
  });

  it('unlocks safely when creation fails', async () => {
    const lock = { current: false };
    const setPending = vi.fn();

    await expect(
      runSingleAgentCreation({
        lock,
        setPending,
        request: async () => {
          throw new Error('network failed');
        },
        onCreated: vi.fn(),
        refresh: vi.fn(),
      })
    ).rejects.toThrow('network failed');

    expect(lock.current).toBe(false);
    expect(setPending).toHaveBeenLastCalledWith(false);
  });
});
