import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAgentProfilesCache,
  loadAgentProfiles,
} from './agent-profiles-client';

beforeEach(() => {
  clearAgentProfilesCache();
  vi.restoreAllMocks();
});

function response(name: string) {
  return {
    ok: true,
    json: async () => ({
      configured: true,
      agents: [
        {
          id: name,
          name,
          agent_type: 'sales',
          system_prompt: '',
          is_active: true,
          is_default: false,
        },
      ],
    }),
  } as Response;
}

describe('tenant-scoped agent profile cache', () => {
  it('deduplicates a slow in-flight request and reuses the safe short cache', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        () => new Promise<Response>((resolve) => (resolveFetch = resolve))
      );

    const first = loadAgentProfiles('account-a', { now: 1_000 });
    const repeatedClick = loadAgentProfiles('account-a', { now: 1_000 });
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveFetch(response('agent-a'));
    await expect(first).resolves.toEqual(await repeatedClick);

    await loadAgentProfiles('account-a', { now: Date.now() });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('never reuses one tenant cache entry for another tenant', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response('agent-a'))
      .mockResolvedValueOnce(response('agent-b'));

    const accountA = await loadAgentProfiles('account-a');
    const accountB = await loadAgentProfiles('account-b');

    expect(accountA.agents[0]?.name).toBe('agent-a');
    expect(accountB.agents[0]?.name).toBe('agent-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache an unconfigured onboarding decision', async () => {
    const unconfigured = {
      ok: true,
      json: async () => ({ configured: false, agents: [] }),
    } as Response;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(unconfigured);

    await loadAgentProfiles('account-a');
    await loadAgentProfiles('account-a');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
