import { describe, expect, it, vi } from 'vitest';
import {
  createTransformRequest,
  parseServerTiming,
  requestCopilot,
  runSingleCopilotAction,
} from './copilot-client';

describe('Copilot client', () => {
  it.each([
    ['translate', 'Urdu'],
    ['translate', 'French'],
    ['rewrite', 'Urdu'],
    ['rewrite', 'English'],
    ['rewrite', 'Spanish'],
  ] as const)(
    'forwards the selected language for %s in %s',
    (action, targetLanguage) => {
      expect(
        createTransformRequest(action, 'Original draft', targetLanguage)
      ).toEqual({
        action,
        input: 'Original draft',
        targetLanguage,
      });
    }
  );

  it('prevents repeated action clicks while a slow request is pending', async () => {
    let resolveRequest!: (value: string) => void;
    const request = vi.fn(
      () => new Promise<string>((resolve) => (resolveRequest = resolve))
    );
    const lock = { current: false };
    const setPending = vi.fn();
    const onSuccess = vi.fn();
    const options = { lock, setPending, request, onSuccess };

    const first = runSingleCopilotAction(options);
    await expect(runSingleCopilotAction(options)).resolves.toBe(false);
    expect(request).toHaveBeenCalledOnce();
    expect(setPending).toHaveBeenNthCalledWith(1, true);

    resolveRequest('done');
    await expect(first).resolves.toBe(true);
    expect(onSuccess).toHaveBeenCalledWith('done');
    expect(setPending).toHaveBeenLastCalledWith(false);
  });

  it('returns end-to-end and Server-Timing measurements', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: 'Call the customer' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Server-Timing':
            'auth;dur=20.0, provider;dur=9000.0, total;dur=9100.0',
        },
      })
    );
    const times = [100, 9_250];

    const result = await requestCopilot(
      { action: 'next_action', conversationId: 'conv-1' },
      { fetcher, now: () => times.shift()! }
    );

    expect(result.totalMs).toBe(9_150);
    expect(parseServerTiming(result.serverTiming)).toEqual({
      auth: 20,
      provider: 9000,
      total: 9100,
    });
  });

  it('shows a meaningful timeout error', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(
      requestCopilot(
        { action: 'summary', conversationId: 'conv-1' },
        { fetcher }
      )
    ).rejects.toThrow('Copilot request timed out. Please retry.');
  });
});
