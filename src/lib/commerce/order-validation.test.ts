import { describe, expect, it } from "vitest";
import { validateOrderDraft } from "./order-validation";

const activeProducts = ["product-1"];

describe("validateOrderDraft", () => {
  it("accepts valid order data and normalizes empty optional amounts", () => {
    expect(
      validateOrderDraft(
        { productId: "product-1", quantity: "2", discount: "", tax: null },
        activeProducts,
      ),
    ).toEqual({
      ok: true,
      value: { productId: "product-1", quantity: 2, discount: 0, tax: 0 },
    });
  });

  it.each([
    ["missing product", { productId: "", quantity: "1", discount: "0", tax: "0" }, "Select a product"],
    ["inactive product", { productId: "product-2", quantity: "1", discount: "0", tax: "0" }, "no longer available"],
    ["zero quantity", { productId: "product-1", quantity: "0", discount: "0", tax: "0" }, "quantity greater than zero"],
    ["negative discount", { productId: "product-1", quantity: "1", discount: "-1", tax: "0" }, "Discount must be zero or greater"],
    ["invalid tax", { productId: "product-1", quantity: "1", discount: "0", tax: "not-a-number" }, "Tax must be zero or greater"],
  ])("rejects %s", (_name, draft, message) => {
    const result = validateOrderDraft(draft, activeProducts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});
