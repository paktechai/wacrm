import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/platform/admin";

// Every platform-admin route is identity- and database-dependent. Never attempt
// to prerender these pages during `next build`; doing so would both be incorrect
// for per-request authorization and would require a live Supabase connection in CI.
export const dynamic = "force-dynamic";

export default async function PlatformAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/dashboard");
  }

  return children;
}
