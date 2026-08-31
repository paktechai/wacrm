import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchBody = {
  priority?: "low" | "normal" | "high" | "urgent";
  snoozedUntil?: string | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  sentiment?: "positive" | "neutral" | "negative" | "unknown";
  detectedIntent?: string | null;
  summary?: string | null;
  nextAction?: string | null;
};

const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const SENTIMENTS = new Set(["positive", "neutral", "negative", "unknown"]);

function isoOrNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null || value === "") return value ?? null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date value");
  return date.toISOString();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const { conversationId } = await params;
    const body = (await request.json()) as PatchBody;

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation id is required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.priority !== undefined) {
      if (!PRIORITIES.has(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      patch.priority = body.priority;
    }

    if (body.sentiment !== undefined) {
      if (!SENTIMENTS.has(body.sentiment)) {
        return NextResponse.json({ error: "Invalid sentiment" }, { status: 400 });
      }
      patch.customer_sentiment = body.sentiment;
    }

    if (body.snoozedUntil !== undefined) patch.snoozed_until = isoOrNull(body.snoozedUntil);
    if (body.firstResponseDueAt !== undefined)
      patch.first_response_due_at = isoOrNull(body.firstResponseDueAt);
    if (body.resolutionDueAt !== undefined)
      patch.resolution_due_at = isoOrNull(body.resolutionDueAt);

    if (body.detectedIntent !== undefined)
      patch.detected_intent = body.detectedIntent?.trim().slice(0, 240) || null;
    if (body.summary !== undefined)
      patch.ai_summary = body.summary?.trim().slice(0, 4000) || null;
    if (body.nextAction !== undefined)
      patch.next_action = body.nextAction?.trim().slice(0, 1000) || null;

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    const { data: conversation, error } = await supabase
      .from("conversations")
      .update(patch)
      .eq("id", conversationId)
      .eq("account_id", accountId)
      .select(
        "id, priority, snoozed_until, first_response_due_at, resolution_due_at, customer_sentiment, detected_intent, ai_summary, next_action, updated_at",
      )
      .maybeSingle();

    if (error) throw error;
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    try {
      const admin = createAdminClient();
      await admin.from("tenant_audit_log").insert({
        account_id: accountId,
        actor_user_id: userId,
        event: "conversation.operations.updated",
        object_type: "conversation",
        object_id: conversationId,
        metadata: patch,
      });
    } catch (auditError) {
      console.error("[inbox ops] audit log failed", auditError);
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid date value") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
