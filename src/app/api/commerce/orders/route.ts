import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeTenantAudit } from "@/lib/audit/tenant";

type ItemInput = { productId?: string; quantity?: number };

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole("viewer");
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole("agent");
    const body = await request.json();
    const requested = Array.isArray(body?.items) ? (body.items as ItemInput[]) : [];
    if (requested.length === 0 || requested.length > 100) {
      return NextResponse.json({ error: "At least one product is required" }, { status: 400 });
    }

    const productIds = [...new Set(requested.map((item) => item.productId).filter((id): id is string => typeof id === "string" && id.length > 0))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,name,sku,price,currency")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .in("id", productIds);
    if (productsError) throw productsError;
    const byId = new Map((products ?? []).map((product) => [product.id, product] as const));

    const lines = requested.map((item) => {
      const product = item.productId ? byId.get(item.productId) : null;
      if (!product) throw new Error("One or more products were not found");
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity");
      const unitPrice = Number(product.price ?? 0);
      return {
        product,
        quantity,
        unitPrice,
        lineTotal: Math.round(unitPrice * quantity * 100) / 100,
      };
    });

    const currency = lines[0]?.product.currency || "PKR";
    if (lines.some((line) => line.product.currency !== currency)) {
      return NextResponse.json({ error: "All order items must use the same currency" }, { status: 400 });
    }
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const discount = Math.max(0, Number(body?.discount ?? 0));
    const tax = Math.max(0, Number(body?.tax ?? 0));
    const total = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);
    const orderNumber = `SBYT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        account_id: accountId,
        contact_id: body?.contactId || null,
        conversation_id: body?.conversationId || null,
        order_number: orderNumber,
        status: "pending",
        subtotal,
        discount,
        tax,
        total,
        currency,
        notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (orderError) throw orderError;

    const { error: itemError } = await supabase.from("order_items").insert(
      lines.map((line) => ({
        account_id: accountId,
        order_id: order.id,
        product_id: line.product.id,
        name: line.product.name,
        sku: line.product.sku,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        line_total: line.lineTotal,
      })),
    );
    if (itemError) throw itemError;

    void writeTenantAudit({ accountId, actorUserId: userId, event: "commerce.order.created", objectType: "order", objectId: order.id, metadata: { order_number: order.order_number, total: order.total, currency: order.currency } });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["One or more products were not found", "Invalid quantity"].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
