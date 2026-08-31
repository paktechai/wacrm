import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

function normalizeOrigins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      result.add(parsed.origin);
    } catch {
      // Ignore malformed origins instead of storing ambiguous host fragments.
    }
  }
  return [...result].slice(0, 25);
}

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("viewer");
    const { data, error } = await supabase
      .from("webchat_widgets")
      .select("id, public_key, name, welcome_message, allowed_origins, is_active, created_at, updated_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ widgets: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("admin");
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "Website Chat";
    const welcome =
      typeof body?.welcomeMessage === "string" && body.welcomeMessage.trim()
        ? body.welcomeMessage.trim().slice(0, 500)
        : "Hi! How can we help?";
    if (!name || name.length > 120) {
      return NextResponse.json({ error: "Widget name must be 1-120 characters" }, { status: 400 });
    }

    const { data: widget, error } = await supabase
      .from("webchat_widgets")
      .insert({
        account_id: accountId,
        created_by: userId,
        name,
        welcome_message: welcome,
        allowed_origins: normalizeOrigins(body?.allowedOrigins),
      })
      .select("id, public_key, name, welcome_message, allowed_origins, is_active, created_at, updated_at")
      .single();
    if (error) throw error;

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "webchat.widget.created",
      objectType: "webchat_widget",
      objectId: widget.id,
      metadata: { name: widget.name },
    });
    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
