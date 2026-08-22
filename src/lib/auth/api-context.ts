// ============================================================
// Public API authentication — resolve a request's API key into an
// account context and enforce the SBYT SaaS boundary.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import {
  findActiveKeyByHash,
  getApiAccessState,
  touchLastUsed,
} from '@/lib/api-keys/store';
import { hashApiKey, looksLikeApiKey } from '@/lib/api-keys/keys';
import { hasScope, type ApiScope } from '@/lib/api-keys/scopes';
import { forbidden, rateLimited, unauthorized } from '@/lib/api/v1/respond';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { incrementUsageBestEffort } from '@/lib/billing/metering';
import { SBYT_METRICS } from '@/lib/billing/catalog';

export interface ApiKeyContext {
  authType: 'api_key';
  supabase: SupabaseClient;
  accountId: string;
  keyId: string;
  scopes: string[];
  createdBy: string | null;
}

function extractKey(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const value = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : header.trim();
  return value.length > 0 ? value : null;
}

export async function requireApiKey(
  request: Request,
  scope?: ApiScope
): Promise<ApiKeyContext> {
  const presented = extractKey(request);
  if (!presented || !looksLikeApiKey(presented)) {
    throw unauthorized();
  }

  const row = await findActiveKeyByHash(hashApiKey(presented));
  if (!row) {
    throw unauthorized();
  }

  const limit = checkRateLimit(`apikey:${row.id}`, RATE_LIMITS.publicApi);
  if (!limit.success) {
    throw rateLimited(limit);
  }

  if (scope && !hasScope(row.scopes, scope)) {
    throw forbidden(`This API key is missing the '${scope}' scope`);
  }

  // API-key routes use a service-role Supabase client and therefore bypass
  // tenant RLS. Enforce workspace lifecycle, subscription state, plan API
  // entitlement and monthly API quota before handing that client to a route.
  const access = await getApiAccessState(row.account_id);
  if (!access.allowed) {
    switch (access.reason) {
      case 'workspace_inactive':
        throw forbidden('This workspace is not currently active');
      case 'subscription_inactive':
        throw forbidden('This subscription is not currently active');
      case 'limit_reached':
        throw forbidden(
          access.limit === undefined
            ? 'The API request limit has been reached'
            : `The API request limit has been reached (${access.current ?? access.limit}/${access.limit})`,
        );
      default:
        throw forbidden('The current plan does not include public API access');
    }
  }

  touchLastUsed(row.id);
  incrementUsageBestEffort(row.account_id, SBYT_METRICS.apiRequests, 1);

  return {
    authType: 'api_key',
    supabase: supabaseAdmin(),
    accountId: row.account_id,
    keyId: row.id,
    scopes: row.scopes,
    createdBy: row.created_by,
  };
}
