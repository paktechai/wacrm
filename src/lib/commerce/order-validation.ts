type OrderDraft = {
  productId: FormDataEntryValue | null;
  quantity: FormDataEntryValue | null;
  discount: FormDataEntryValue | null;
  tax: FormDataEntryValue | null;
};

type ValidOrderDraft = {
  productId: string;
  quantity: number;
  discount: number;
  tax: number;
};

export function validateOrderDraft(
  draft: OrderDraft,
  activeProductIds: readonly string[],
): { ok: true; value: ValidOrderDraft } | { ok: false; error: string } {
  const productId = typeof draft.productId === "string" ? draft.productId.trim() : "";
  if (!productId) return { ok: false, error: "Select a product to create the order." };
  if (!activeProductIds.includes(productId)) {
    return { ok: false, error: "The selected product is no longer available. Choose another product." };
  }

  const quantity = Number(draft.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Enter a quantity greater than zero." };
  }

  const discount = draft.discount === "" || draft.discount === null ? 0 : Number(draft.discount);
  if (!Number.isFinite(discount) || discount < 0) {
    return { ok: false, error: "Discount must be zero or greater." };
  }

  const tax = draft.tax === "" || draft.tax === null ? 0 : Number(draft.tax);
  if (!Number.isFinite(tax) || tax < 0) {
    return { ok: false, error: "Tax must be zero or greater." };
  }

  return { ok: true, value: { productId, quantity, discount, tax } };
}
