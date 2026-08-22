import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/account";

export type PlatformAdminRole = "super_admin" | "support" | "billing_admin";

export interface PlatformAdminContext {
  userId: string;
  email: string | null;
  role: PlatformAdminRole;
}

function bootstrapEmails(): Set<string> {
  return new Set(
    (process.env.SBYT_SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Returns the current platform-admin context, or null when the caller
 * is authenticated but is not an SBYT platform administrator.
 *
 * Bootstrap: SBYT_SUPER_ADMIN_EMAILS may contain comma-separated emails.
 * This lets the first super admin enter the platform before a DB row exists.
 */
export async function getPlatformAdmin(): Promise<PlatformAdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
  if (normalizedEmail && bootstrapEmails().has(normalizedEmail)) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "super_admin",
    };
  }

  const admin = createAdminClient();
  const { data, error: adminError } = await admin
    .from("platform_admins")
    .select("role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    console.error("[getPlatformAdmin] lookup failed:", adminError);
    return null;
  }

  if (!data?.active) return null;

  const role = data.role as PlatformAdminRole;
  if (!(["super_admin", "support", "billing_admin"] as const).includes(role)) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
  };
}

export async function requirePlatformAdmin(
  allowed: PlatformAdminRole[] = ["super_admin", "support", "billing_admin"],
): Promise<PlatformAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthorizedError();

  const admin = await getPlatformAdmin();
  if (!admin || !allowed.includes(admin.role)) {
    throw new ForbiddenError("Platform administrator access required");
  }

  return admin;
}
