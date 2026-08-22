import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

const GOALS = new Set(["delivery_rate", "read_rate", "reply_rate", "conversion_rate"]);

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("viewer");
    const { data, error } = await supabase
      .from("campaign_experiments")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ experiments: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const key = typeof body?.experimentKey === "string" ? body.experimentKey.trim().toLowerCase() : "";
    const goal = GOALS.has(body?.goal) ? body.goal : "reply_rate";
    if (!name || name.length > 120 || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(key)) {
      return NextResponse.json({ error: "Valid experiment name and key are required" }, { status: 400 });
    }

    const { data: experiment, error } = await supabase
      .from("campaign_experiments")
      .insert({
        account_id: accountId,
        created_by: userId,
        name,
        experiment_key: key,
        goal,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Experiment key already exists" }, { status: 409 });
      }
      throw error;
    }

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "marketing.experiment.created",
      objectType: "campaign_experiment",
      objectId: experiment.id,
      metadata: { experiment_key: key, goal },
    });
    return NextResponse.json({ experiment }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
