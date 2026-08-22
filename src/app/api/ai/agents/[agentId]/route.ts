import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

const AGENT_TYPES = new Set(["sales", "support", "receptionist", "lead_qualifier", "custom"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole("admin");
    const { agentId } = await params;
    const body = await request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name || name.length > 80) {
        return NextResponse.json({ error: "Agent name must be 1-80 characters" }, { status: 400 });
      }
      patch.name = name;
    }
    if (body?.agentType !== undefined && AGENT_TYPES.has(body.agentType)) patch.agent_type = body.agentType;
    if (body?.systemPrompt !== undefined)
      patch.system_prompt = typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "";
    if (body?.goals !== undefined) patch.goals = Array.isArray(body.goals) ? body.goals.slice(0, 20) : [];
    if (body?.toolPolicy !== undefined)
      patch.tool_policy = body.toolPolicy && typeof body.toolPolicy === "object" ? body.toolPolicy : {};
    if (body?.handoffPolicy !== undefined)
      patch.handoff_policy = body.handoffPolicy && typeof body.handoffPolicy === "object" ? body.handoffPolicy : {};
    if (body?.isActive !== undefined) patch.is_active = body.isActive === true;

    if (body?.isDefault === true) {
      const { error: resetError } = await supabase
        .from("ai_agent_profiles")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("account_id", accountId)
        .eq("is_default", true);
      if (resetError) throw resetError;
      patch.is_default = true;
    } else if (body?.isDefault === false) {
      patch.is_default = false;
    }

    const { data: agent, error } = await supabase
      .from("ai_agent_profiles")
      .update(patch)
      .eq("id", agentId)
      .eq("account_id", accountId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    if (body?.isDefault === true) {
      await supabase
        .from("ai_configs")
        .update({ default_agent_id: agent.id })
        .eq("account_id", accountId);
    }

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "ai.agent.updated",
      objectType: "ai_agent_profile",
      objectId: agentId,
      metadata: patch,
    });

    return NextResponse.json({ agent });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole("admin");
    const { agentId } = await params;
    const { error } = await supabase
      .from("ai_agent_profiles")
      .delete()
      .eq("id", agentId)
      .eq("account_id", accountId);
    if (error) throw error;

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "ai.agent.deleted",
      objectType: "ai_agent_profile",
      objectId: agentId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
