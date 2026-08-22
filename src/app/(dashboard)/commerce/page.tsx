"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Package, Plus, RefreshCw, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  currency: string;
  is_active: boolean;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
};

export default function CommercePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, ordersRes] = await Promise.all([
        fetch("/api/commerce/products", { cache: "no-store" }),
        fetch("/api/commerce/orders", { cache: "no-store" }),
      ]);
      const [productsJson, ordersJson] = await Promise.all([
        productsRes.json(),
        ordersRes.json(),
      ]);
      if (!productsRes.ok) throw new Error(productsJson?.error || "Could not load products");
      if (!ordersRes.ok) throw new Error(ordersJson?.error || "Could not load orders");
      setProducts(productsJson.products ?? []);
      setOrders(ordersJson.orders ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load commerce workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalValue = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders],
  );

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingProduct) return;
    const form = new FormData(event.currentTarget);
    setCreatingProduct(true);
    try {
      const response = await fetch("/api/commerce/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          sku: form.get("sku"),
          price: Number(form.get("price") || 0),
          currency: form.get("currency") || "PKR",
          description: form.get("description"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not create product");
      event.currentTarget.reset();
      setProducts((items) => [payload.product, ...items]);
      toast.success("Product created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create product");
    } finally {
      setCreatingProduct(false);
    }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingOrder) return;
    const form = new FormData(event.currentTarget);
    const productId = String(form.get("productId") || "");
    const quantity = Number(form.get("quantity") || 1);
    setCreatingOrder(true);
    try {
      const response = await fetch("/api/commerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId, quantity }],
          discount: Number(form.get("discount") || 0),
          tax: Number(form.get("tax") || 0),
          notes: form.get("notes"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not create order");
      event.currentTarget.reset();
      setOrders((items) => [payload.order, ...items]);
      toast.success(`Order ${payload.order.order_number} created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create order");
    } finally {
      setCreatingOrder(false);
    }
  }

  async function createPaymentLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingLink) return;
    const form = new FormData(event.currentTarget);
    setCreatingLink(true);
    try {
      const response = await fetch("/api/commerce/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: form.get("orderId") || null,
          provider: form.get("provider") || "manual",
          url: form.get("url"),
          amount: Number(form.get("amount") || 0),
          currency: form.get("linkCurrency") || "PKR",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not create payment link");
      event.currentTarget.reset();
      toast.success("Payment link saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create payment link");
    } finally {
      setCreatingLink(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Commerce</div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Catalog & orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage products, create customer orders and attach provider-neutral payment links from the same CRM workspace.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Package className="size-4" />} label="Products" value={products.length.toLocaleString()} />
        <Metric icon={<ShoppingBag className="size-4" />} label="Orders" value={orders.length.toLocaleString()} />
        <Metric icon={<CreditCard className="size-4" />} label="Order value" value={totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold text-foreground">Product catalog</h2>
            <form onSubmit={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="name" required maxLength={160} placeholder="Product name" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="sku" placeholder="SKU (optional)" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="price" required type="number" min="0" step="0.01" placeholder="Price" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="currency" defaultValue="PKR" maxLength={8} className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="description" placeholder="Description" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2" />
              <button disabled={creatingProduct} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">
                <Plus className="size-4" /> {creatingProduct ? "Creating…" : "Add product"}
              </button>
            </form>
          </div>
          <div className="divide-y divide-border">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-4 p-4">
                <div><div className="font-medium text-foreground">{product.name}</div><div className="mt-1 text-xs text-muted-foreground">{product.sku || "No SKU"}</div></div>
                <div className="text-sm font-semibold text-foreground">{product.currency} {Number(product.price).toLocaleString()}</div>
              </div>
            ))}
            {!loading && products.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No products yet.</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold text-foreground">Create order</h2>
            <form onSubmit={createOrder} className="mt-4 grid gap-3 sm:grid-cols-2">
              <select name="productId" required className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2">
                <option value="">Select product</option>
                {products.filter((product) => product.is_active).map((product) => <option key={product.id} value={product.id}>{product.name} — {product.currency} {Number(product.price).toLocaleString()}</option>)}
              </select>
              <input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="discount" type="number" min="0" step="0.01" defaultValue="0" placeholder="Discount" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="tax" type="number" min="0" step="0.01" defaultValue="0" placeholder="Tax" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="notes" placeholder="Order notes" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button disabled={creatingOrder || products.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"><ShoppingBag className="size-4" /> {creatingOrder ? "Creating…" : "Create order"}</button>
            </form>
          </div>
          <div className="divide-y divide-border">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-4 p-4">
                <div><div className="font-mono text-sm font-medium text-foreground">{order.order_number}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()} · {order.status}</div></div>
                <div className="text-sm font-semibold text-foreground">{order.currency} {Number(order.total).toLocaleString()}</div>
              </div>
            ))}
            {!loading && orders.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No orders yet.</div> : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Payment link registry</h2>
        <p className="mt-1 text-sm text-muted-foreground">Store a secure provider checkout URL after your chosen payment gateway creates it. No card data is stored in SBYT CRM.</p>
        <form onSubmit={createPaymentLink} className="mt-4 grid gap-3 md:grid-cols-5">
          <select name="orderId" className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="">No linked order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.order_number}</option>)}</select>
          <input name="provider" placeholder="Provider" defaultValue="manual" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <input name="url" required type="url" placeholder="https://checkout…" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <input name="amount" required type="number" min="0" step="0.01" placeholder="Amount" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2"><input name="linkCurrency" defaultValue="PKR" maxLength={8} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /><button disabled={creatingLink} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save</button></div>
        </form>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><span className="text-primary">{icon}</span></div><div className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</div></div>;
}
