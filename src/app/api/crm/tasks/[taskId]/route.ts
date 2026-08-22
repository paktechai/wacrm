import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const { taskId } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body?.title === "string") {
      const title = body.title.trim();
      if (!title || title.length > 200) {
        return NextResponse.json({ error: "Title must be 1-200 characters" }, { status: 400 });
      }
      patch.title = title;
    }
    if (["open", "in_progress", "done", "cancelled"].includes(body?.status)) {
      patch.status = body.status;
      patch.completed_at = body.status === "done" ? new Date().toISOString() : null;
    }
    if (["low", "normal", "high", "urgent"].includes(body?.priority)) {
      patch.priority = body.priority;
    }
    if (body?.dueAt !== undefined) {
      if (body.dueAt === null || body.dueAt === "") patch.due_at = null;
      else {
        const due = new Date(body.dueAt);
        if (Number.isNaN(due.getTime())) {
          return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
        }
        patch.due_at = due.toISOString();
      }
    }
    if (body?.assignedTo !== undefined) patch.assigned_to = body.assignedTo || null;
    if (body?.description !== undefined)
      patch.description = typeof body.description === "string" ? body.description.trim() || null : null;

    const { data: task, error } = await supabase
      .from("crm_tasks")
      .update(patch)
      .eq("id", taskId)
      .eq("account_id", accountId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "crm.task.updated",
      objectType: "crm_task",
      objectId: taskId,
      metadata: patch,
    });

    return NextResponse.json({ task });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole("admin");
    const { taskId } = await params;
    const { error } = await supabase
      .from("crm_tasks")
      .delete()
      .eq("id", taskId)
      .eq("account_id", accountId);
    if (error) throw error;

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "crm.task.deleted",
      objectType: "crm_task",
      objectId: taskId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
