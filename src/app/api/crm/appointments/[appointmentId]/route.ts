import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const { appointmentId } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body?.title === "string") {
      const title = body.title.trim();
      if (!title || title.length > 200) {
        return NextResponse.json({ error: "Title must be 1-200 characters" }, { status: 400 });
      }
      patch.title = title;
    }
    if (["scheduled", "confirmed", "completed", "cancelled", "no_show"].includes(body?.status)) {
      patch.status = body.status;
    }
    if (body?.startsAt !== undefined) {
      const startsAt = new Date(body.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
      }
      patch.starts_at = startsAt.toISOString();
    }
    if (body?.endsAt !== undefined) {
      const endsAt = new Date(body.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
      }
      patch.ends_at = endsAt.toISOString();
    }
    if (body?.notes !== undefined)
      patch.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    if (body?.assignedTo !== undefined) patch.assigned_to = body.assignedTo || null;

    const { data: appointment, error } = await supabase
      .from("crm_appointments")
      .update(patch)
      .eq("id", appointmentId)
      .eq("account_id", accountId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "crm.appointment.updated",
      objectType: "crm_appointment",
      objectId: appointmentId,
      metadata: patch,
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole("admin");
    const { appointmentId } = await params;
    const { error } = await supabase
      .from("crm_appointments")
      .delete()
      .eq("id", appointmentId)
      .eq("account_id", accountId);
    if (error) throw error;

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "crm.appointment.deleted",
      objectType: "crm_appointment",
      objectId: appointmentId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
