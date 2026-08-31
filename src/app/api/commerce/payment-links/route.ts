import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const amount = Number(body?.amount ?? 0);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "A valid payment URL is required" }, { status: 400 });
    }
    if (!["https:", "http:"].includes(parsed.protocol) || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Valid URL and non-negative amount are required" }, { status: 400 });
    }

    const { data: link, error } = await supabase
      .from("payment_links")
      .insert({
        account_id: accountId,
        order_id: body?.orderId || null,
        provider: typeof body?.provider === "string" && body.provider.trim() ? body.provider.trim().slice(0, 80) : "manual",
        external_payment_ref: typeof body?.externalPaymentRef === "string" ? body.externalPaymentRef.trim() || null : null,
        url: parsed.toString(),
        amount,
        currency: typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase().slice(0, 8) : "PKR",
        expires_at: body?.expiresAt ? new Date(body.expiresAt).toISOString() : null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    void writeTenantAudit({ accountId, actorUserId: userId, event: "commerce.payment_link.created", objectType: "payment_link", objectId: link.id, metadata: { provider: link.provider, amount: link.amount, currency: link.currency } });
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
