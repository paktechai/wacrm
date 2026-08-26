import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

const AGENT_TYPES = new Set(["sales", "support", "receptionist", "lead_qualifier", "custom"]);

export async function GET() {
  const startedAt = performance.now();
  try {
    const { supabase, accountId } = await requireRole("admin");
    const authDoneAt = performance.now();
    const [agentsResult, configResult] = await Promise.all([
      supabase
        .from("ai_agent_profiles")
        .select("id, name, agent_type, system_prompt, is_active, is_default")
        .eq("account_id", accountId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("ai_configs")
        .select("id")
        .eq("account_id", accountId)
        .maybeSingle(),
    ]);
    if (agentsResult.error) throw agentsResult.error;
    if (configResult.error) throw configResult.error;

    const finishedAt = performance.now();
    const response = NextResponse.json({
      agents: agentsResult.data ?? [],
      configured: Boolean(configResult.data),
    });
    response.headers.set(
      "Server-Timing",
      `auth;dur=${(authDoneAt - startedAt).toFixed(1)}, db;dur=${(finishedAt - authDoneAt).toFixed(1)}, total;dur=${(finishedAt - startedAt).toFixed(1)}`,
    );
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    // Body parsing is independent of authorization; overlap it with the auth
    // round trip, while keeping every database write strictly after the role
    // check has succeeded.
    const [{ supabase, accountId, userId }, body] = await Promise.all([
      requireRole("admin"),
      request.json(),
    ]);
    const authDoneAt = performance.now();
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
      .select("id, name, agent_type, system_prompt, is_active, is_default")
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

    const finishedAt = performance.now();
    const response = NextResponse.json({ agent }, { status: 201 });
    response.headers.set(
      "Server-Timing",
      `auth;dur=${(authDoneAt - startedAt).toFixed(1)}, db;dur=${(finishedAt - authDoneAt).toFixed(1)}, total;dur=${(finishedAt - startedAt).toFixed(1)}`,
    );
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
