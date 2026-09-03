import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/auth/account", () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn(() => Response.json({ error: "failed" }, { status: 500 })),
}));

vi.mock("@/lib/audit/tenant", () => ({
  writeTenantAudit: vi.fn(),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/commerce/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.from.mockReset();
  mocks.requireRole.mockReset();
  mocks.requireRole.mockResolvedValue({
    supabase: { from: mocks.from },
    accountId: "account-1",
    userId: "user-1",
  });
});

describe("POST /api/commerce/orders validation", () => {
  it.each([
    [{ items: [] }, "At least one product is required"],
    [{ items: [{ productId: "", quantity: 1 }] }, "available product"],
    [{ items: [{ productId: "product-1", quantity: 0 }] }, "quantity greater than zero"],
    [{ items: [{ productId: "product-1", quantity: 1 }], discount: -1 }, "Discount and tax"],
    [{ items: [{ productId: "product-1", quantity: 1 }], tax: "invalid" }, "Discount and tax"],
  ])("rejects malformed order data before querying commerce tables", async (body, message) => {
    const response = await POST(request(body));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain(message);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
