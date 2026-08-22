import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("viewer");
    const { data, error } = await supabase
      .from("contact_segments")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ segments: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) {
      return NextResponse.json({ error: "Segment name must be 1-100 characters" }, { status: 400 });
    }
    const filter = body?.filter && typeof body.filter === "object" ? body.filter : {};
    const { data: segment, error } = await supabase
      .from("contact_segments")
      .insert({
        account_id: accountId,
        created_by: userId,
        name,
        description: typeof body?.description === "string" ? body.description.trim() || null : null,
        filter,
        is_dynamic: body?.isDynamic !== false,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A segment with this name already exists" }, { status: 409 });
      }
      throw error;
    }
    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "marketing.segment.created",
      objectType: "contact_segment",
      objectId: segment.id,
      metadata: { name: segment.name },
    });
    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
