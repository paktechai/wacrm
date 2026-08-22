import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/platform/admin";

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
