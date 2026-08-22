import { NextResponse } from "next/server";

import { ForbiddenError, requireRole, toErrorResponse } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeTenantAudit } from "@/lib/audit/tenant";

const MAX_ROWS = 5000;

export async function GET() {
  try {
    const ctx = await requireRole("admin");

    const { data: security, error: securityError } = await ctx.supabase
      .from("account_security_settings")
      .select("allow_data_export")
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (securityError) throw securityError;
    if (security?.allow_data_export === false) {
      throw new ForbiddenError("Data export is disabled for this workspace");
    }

    const admin = createAdminClient();
    const accountId = ctx.accountId;
    const [contacts, conversations, deals, tasks, appointments, products, orders] = await Promise.all([
      admin.from("contacts").select("*").eq("account_id", accountId).order("created_at").limit(MAX_ROWS),
      admin.from("conversations").select("*").eq("account_id", accountId).order("created_at").limit(MAX_ROWS),
      admin.from("deals").select("*").eq("account_id", accountId).order("created_at").limit(MAX_ROWS),
      admin.from("crm_tasks").select("*").eq("account_id", accountId).order("created_at").limit(MAX_ROWS),
      admin.from("crm_appointments").select("*").eq("account_id", accountId).order("created_at").limit(MAX_ROWS),
      admin.from("products").select("*").eq("account_id", accountId).order("created_at").limit(MAX_ROWS),
      admin.from("orders").select("*").eq("account_id", accountId).order("created_at").limit(MAX_ROWS),
    ]);

    for (const result of [contacts, conversations, deals, tasks, appointments, products, orders]) {
      if (result.error) throw result.error;
    }

    const conversationIds = (conversations.data ?? []).map((row) => row.id as string);
    const messages: Record<string, unknown>[] = [];
    for (let i = 0; i < conversationIds.length && messages.length < MAX_ROWS; i += 150) {
      const chunk = conversationIds.slice(i, i + 150);
      if (chunk.length === 0) break;
      const { data, error } = await admin
        .from("messages")
        .select("*")
        .in("conversation_id", chunk)
        .order("created_at")
        .limit(MAX_ROWS - messages.length);
      if (error) throw error;
      messages.push(...((data ?? []) as Record<string, unknown>[]));
    }

    const orderIds = (orders.data ?? []).map((row) => row.id as string);
    let orderItems: Record<string, unknown>[] = [];
    if (orderIds.length > 0) {
      const { data, error } = await admin
        .from("order_items")
        .select("*")
        .in("order_id", orderIds.slice(0, 1000))
        .limit(MAX_ROWS);
      if (error) throw error;
      orderItems = (data ?? []) as Record<string, unknown>[];
    }

    const exportedAt = new Date().toISOString();
    const payload = {
      schema: "sbyt-crm-export-v1",
      exported_at: exportedAt,
      account: { id: accountId, name: ctx.account.name },
      limits: { max_rows_per_collection: MAX_ROWS },
      data: {
        contacts: contacts.data ?? [],
        conversations: conversations.data ?? [],
        messages,
        deals: deals.data ?? [],
        tasks: tasks.data ?? [],
        appointments: appointments.data ?? [],
        products: products.data ?? [],
        orders: orders.data ?? [],
        order_items: orderItems,
      },
    };

    const rowCounts = Object.fromEntries(
      Object.entries(payload.data).map(([key, value]) => [key, value.length]),
    );

    const { data: exportRow, error: logError } = await admin
      .from("data_export_log")
      .insert({
        account_id: accountId,
        requested_by: ctx.userId,
        format: "json",
        status: "completed",
        row_counts: rowCounts,
        completed_at: exportedAt,
      })
      .select("id")
      .single();
    if (logError) console.error("[enterprise/export] export log failed", logError);

    void writeTenantAudit({
      accountId,
      actorUserId: ctx.userId,
      event: "enterprise.data_export.completed",
      objectType: "data_export",
      objectId: exportRow?.id ?? null,
      metadata: { row_counts: rowCounts },
    });

    const safeDate = exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="sbyt-crm-export-${safeDate}.json"`,
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
