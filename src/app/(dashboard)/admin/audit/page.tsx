import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";

export default async function PlatformAuditPage() {
  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("platform_audit_log")
    .select("id, actor_user_id, action, target_type, target_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Super Admin
      </Link>

      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          <ClipboardList className="size-4" />
          Platform audit
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Administrative activity
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Latest 200 platform-level changes made through Wova8 Super Admin.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Action</th>
                <th className="px-5 py-3 font-semibold">Target</th>
                <th className="px-5 py-3 font-semibold">Actor</th>
                <th className="px-5 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(events ?? []).map((event) => (
                <tr key={event.id} className="align-top hover:bg-muted/20">
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(event.created_at))}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                      {event.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    <div>{event.target_type ?? "—"}</div>
                    <div className="mt-1 max-w-56 truncate font-mono text-[10px]">
                      {event.target_id ?? "—"}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-[10px] text-muted-foreground">
                    {event.actor_user_id ?? "system"}
                  </td>
                  <td className="max-w-md px-5 py-4">
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-2 text-[10px] leading-4 text-muted-foreground">
                      {JSON.stringify(event.metadata ?? {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {(events ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No platform audit events yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
