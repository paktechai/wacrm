import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

const AGENT_TYPES = new Set(["sales", "support", "receptionist", "lead_qualifier", "custom"]);

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("admin");
    const { data, error } = await supabase
      .from("ai_agent_profiles")
      .select("*")
      .eq("account_id", accountId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ agents: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("admin");
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const agentType = AGENT_TYPES.has(body?.agentType) ? body.agentType : "custom";
    const systemPrompt = typeof body?.systemPrompt === "string" ? body.systemPrompt.trim() : "";
    const isDefault = body?.isDefault === true;

    if (!name || name.length > 80) {
      return NextResponse.json({ error: "Agent name must be 1-80 characters" }, { status: 400 });
    }
    if (isDefault) {
      const { error: resetError } = await supabase
        .from("ai_agent_profiles")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("account_id", accountId)
        .eq("is_default", true);
      if (resetError) throw resetError;
    }

    const { data: agent, error } = await supabase
      .from("ai_agent_profiles")
      .insert({
        account_id: accountId,
        created_by: userId,
        name,
        agent_type: agentType,
        system_prompt: systemPrompt,
        goals: Array.isArray(body?.goals) ? body.goals.slice(0, 20) : [],
        tool_policy: body?.toolPolicy && typeof body.toolPolicy === "object" ? body.toolPolicy : {},
        handoff_policy:
          body?.handoffPolicy && typeof body.handoffPolicy === "object" ? body.handoffPolicy : {},
        is_active: body?.isActive !== false,
        is_default: isDefault,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (isDefault) {
      await supabase
        .from("ai_configs")
        .update({ default_agent_id: agent.id })
        .eq("account_id", accountId);
    }

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "ai.agent.created",
      objectType: "ai_agent_profile",
      objectId: agent.id,
      metadata: { name: agent.name, agent_type: agent.agent_type },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
