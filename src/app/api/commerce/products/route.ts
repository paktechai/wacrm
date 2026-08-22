import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("viewer");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const price = Number(body?.price ?? 0);
    if (!name || name.length > 160 || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Valid product name and price are required" }, { status: 400 });
    }
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        account_id: accountId,
        name,
        sku: typeof body?.sku === "string" ? body.sku.trim() || null : null,
        description: typeof body?.description === "string" ? body.description.trim() || null : null,
        price,
        currency: typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase().slice(0, 8) : "PKR",
        image_url: typeof body?.imageUrl === "string" ? body.imageUrl.trim() || null : null,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
      throw error;
    }
    void writeTenantAudit({ accountId, actorUserId: userId, event: "commerce.product.created", objectType: "product", objectId: product.id, metadata: { name: product.name, sku: product.sku } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
