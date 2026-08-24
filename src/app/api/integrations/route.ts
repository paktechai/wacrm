import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

const PROVIDERS = new Set([
  "shopify",
  "woocommerce",
  "google_sheets",
  "n8n",
  "zapier",
  "hubspot",
  "custom_webhook",
]);

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("admin");
    const { data, error } = await supabase
      .from("integration_connections")
      .select("id, provider, name, status, settings, last_synced_at, last_error, created_at, updated_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ integrations: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("admin");
    const body = await request.json();
    const provider = typeof body?.provider === "string" ? body.provider.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!PROVIDERS.has(provider) || !name || name.length > 120) {
      return NextResponse.json({ error: "Valid provider and connection name are required" }, { status: 400 });
    }

    // This registry endpoint deliberately does NOT accept provider secrets.
    // OAuth/API credentials must be exchanged by a provider-specific server
    // callback and encrypted before credentials_ciphertext is ever written.
    const settings = body?.settings && typeof body.settings === "object" ? body.settings : {};
    const { data: integration, error } = await supabase
      .from("integration_connections")
      .insert({
        account_id: accountId,
        created_by: userId,
        provider,
        name,
        status: "disconnected",
        settings,
      })
      .select("id, provider, name, status, settings, last_synced_at, last_error, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This integration connection already exists" }, { status: 409 });
      }
      throw error;
    }

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: "integration.registered",
      objectType: "integration_connection",
      objectId: integration.id,
      metadata: { provider, name },
    });

    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
