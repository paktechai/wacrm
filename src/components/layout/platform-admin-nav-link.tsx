"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function PlatformAdminNavLink() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/platform/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { isPlatformAdmin?: boolean };
      })
      .then((payload) => {
        if (!cancelled) setVisible(payload?.isPlatformAdmin === true);
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const active = pathname.startsWith("/admin");
  return (
    <li>
      <Link
        href="/admin"
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ShieldCheck className="h-4 w-4" />
        Platform admin
      </Link>
    </li>
  );
}
