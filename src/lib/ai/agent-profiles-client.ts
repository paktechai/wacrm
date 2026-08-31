export type AgentProfile = {
  id: string;
  name: string;
  agent_type:
    'sales' | 'support' | 'receptionist' | 'lead_qualifier' | 'custom';
  system_prompt: string;
  is_active: boolean;
  is_default: boolean;
};

export type AgentProfilesResult = {
  agents: AgentProfile[];
  configured: boolean;
};

const CACHE_TTL_MS = 30_000;

const cache = new Map<
  string,
  { value: AgentProfilesResult; expiresAt: number }
>();
const inFlight = new Map<string, Promise<AgentProfilesResult>>();

async function requestAgentProfiles(): Promise<AgentProfilesResult> {
  const response = await fetch('/api/ai/agents', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Could not load AI agents');
  }

  return {
    agents: Array.isArray(payload.agents) ? payload.agents : [],
    configured: Boolean(payload.configured),
  };
}

/**
 * Small browser-memory cache, isolated by account id. It avoids another auth
 * and database round trip when an admin revisits the tab, but never shares
 * data between tenants and never changes HTTP/provider credential caching.
 */
export function loadAgentProfiles(
  accountId: string,
  options: { force?: boolean; now?: number } = {}
): Promise<AgentProfilesResult> {
  const now = options.now ?? Date.now();
  const existing = cache.get(accountId);
  if (!options.force && existing && existing.expiresAt > now) {
    return Promise.resolve(existing.value);
  }

  if (!options.force) {
    const pending = inFlight.get(accountId);
    if (pending) return pending;
  }

  const request = requestAgentProfiles().then((value) => {
    // Do not cache the onboarding redirect decision. An admin can finish
    // provider setup and immediately return to Profiles; a cached `false`
    // would otherwise bounce them back to Setup for the remainder of the TTL.
    if (value.configured) {
      cache.set(accountId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    } else {
      cache.delete(accountId);
    }
    return value;
  });

  inFlight.set(accountId, request);
  const clearPending = () => {
    if (inFlight.get(accountId) === request) inFlight.delete(accountId);
  };
  void request.then(clearPending, clearPending);
  return request;
}

export function cacheCreatedAgent(
  accountId: string,
  agent: AgentProfile
): void {
  const existing = cache.get(accountId);
  if (!existing) return;

  const agents = agent.is_default
    ? existing.value.agents.map((item) => ({ ...item, is_default: false }))
    : existing.value.agents;
  cache.set(accountId, {
    value: { ...existing.value, agents: [...agents, agent] },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearAgentProfilesCache(): void {
  cache.clear();
  inFlight.clear();
}
