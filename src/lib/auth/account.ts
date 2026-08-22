// ============================================================
// Server-side account context — for API routes and server
// components. Reads the caller's profile + account and verifies role
// on demand.
// ============================================================

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { hasMinRole, isAccountRole, type AccountRole } from "./roles";

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[toErrorResponse] uncategorized error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export interface AccountContext {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  role: AccountRole;
  account: {
    id: string;
    name: string;
    lifecycleStatus: string;
    requireMfa: boolean;
  };
}

export async function getCurrentAccount(): Promise<AccountContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new UnauthorizedError();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("account_id, account_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getCurrentAccount] profile fetch error:", error);
    throw new ForbiddenError("Could not load account context");
  }
  if (!data || !data.account_id || !data.account_role) {
    throw new ForbiddenError("Profile is not linked to an account");
  }
  if (!isAccountRole(data.account_role)) {
    throw new ForbiddenError(`Unknown account role: ${data.account_role}`);
  }

  const { data: account, error: accountErr } = await supabase
    .from("accounts")
    .select("id, name, lifecycle_status, require_mfa")
    .eq("id", data.account_id)
    .maybeSingle();

  if (accountErr) {
    console.error("[getCurrentAccount] account fetch error:", accountErr);
    throw new ForbiddenError("Could not load account context");
  }
  if (!account) {
    throw new ForbiddenError("Profile is not linked to an account");
  }

  return {
    supabase,
    userId: user.id,
    accountId: data.account_id,
    role: data.account_role,
    account: {
      id: account.id,
      name: account.name,
      lifecycleStatus: account.lifecycle_status ?? "active",
      requireMfa: account.require_mfa === true,
    },
  };
}

export async function requireRole(min: AccountRole): Promise<AccountContext> {
  const ctx = await getCurrentAccount();
  if (!hasMinRole(ctx.role, min)) {
    throw new ForbiddenError(
      `This action requires the '${min}' role or higher`,
    );
  }

  if (
    min !== "viewer" &&
    (ctx.account.lifecycleStatus === "suspended" ||
      ctx.account.lifecycleStatus === "cancelled")
  ) {
    throw new ForbiddenError("This workspace is currently read-only");
  }

  // Enterprise MFA is enforced twice:
  // 1) here, before API routes perform external side effects; and
  // 2) by is_account_operational() in RLS for direct Supabase writes.
  // Read-only viewer calls stay available so users can reach the MFA UI.
  if (min !== "viewer" && ctx.account.requireMfa) {
    const { data: aal, error: aalError } =
      await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      console.error("[requireRole] MFA assurance check failed:", aalError);
      throw new ForbiddenError("Could not verify multi-factor authentication");
    }
    if (aal.currentLevel !== "aal2") {
      throw new ForbiddenError(
        "Multi-factor authentication is required for this workspace",
      );
    }
  }

  return ctx;
}
