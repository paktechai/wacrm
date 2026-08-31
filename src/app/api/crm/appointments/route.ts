import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("viewer");
    const { data, error } = await supabase
      .from("crm_appointments")
      .select("*")
      .eq("account_id", accountId)
      .order("starts_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ appointments: data ?? [] });
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

    const startsAt = new Date(body?.startsAt);
    const endsAt = new Date(body?.endsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      return NextResponse.json({ error: "Appointment start/end is invalid" }, { status: 400 });
    }

    const { data: appointment, error } = await supabase
      .from("crm_appointments")
      .insert({
        account_id: accountId,
        created_by: userId,
        assigned_to: body?.assignedTo || userId,
        contact_id: body?.contactId || null,
        conversation_id: body?.conversationId || null,
        title,
        notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        timezone: typeof body?.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "UTC",
      })
      .select("*")
      .single();
    if (error) throw error;

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "crm.appointment.created",
      objectType: "crm_appointment",
      objectId: appointment.id,
      metadata: { title: appointment.title, starts_at: appointment.starts_at },
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
