import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("viewer");
    const { data, error } = await supabase
      .from("crm_tasks")
      .select("*")
      .eq("account_id", accountId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ tasks: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) {
      return NextResponse.json({ error: "Title must be 1-200 characters" }, { status: 400 });
    }

    const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const { data: task, error } = await supabase
      .from("crm_tasks")
      .insert({
        account_id: accountId,
        created_by: userId,
        assigned_to: body?.assignedTo || userId,
        contact_id: body?.contactId || null,
        conversation_id: body?.conversationId || null,
        deal_id: body?.dealId || null,
        title,
        description: typeof body?.description === "string" ? body.description.trim() || null : null,
        priority: ["low", "normal", "high", "urgent"].includes(body?.priority)
          ? body.priority
          : "normal",
        due_at: dueAt ? dueAt.toISOString() : null,
      })
      .select("*")
      .single();
    if (error) throw error;

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "crm.task.created",
      objectType: "crm_task",
      objectId: task.id,
      metadata: { title: task.title, priority: task.priority },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
