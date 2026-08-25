import { describe, expect, it } from "vitest";
import type { Deal, PipelineStage } from "@/types";
import {
  calculatePipelineMetrics,
  createDealStageTransition,
  createDealStatusTransition,
} from "./pipeline-deals";

const stages = [
  { id: "new", name: "New Lead", position: 0 },
  { id: "negotiation", name: "Negotiation", position: 1 },
  { id: "won", name: "Won", position: 2 },
] as PipelineStage[];

const now = new Date(2026, 7, 25, 12);
const thisMonth = new Date(2026, 7, 12, 12).toISOString();

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "deal-1",
    user_id: "user-1",
    pipeline_id: "pipeline-1",
    stage_id: "new",
    contact_id: "contact-1",
    title: "Test Deal",
    value: 1000,
    status: "open",
    created_at: thisMonth,
    updated_at: thisMonth,
    ...overrides,
  };
}

describe("pipeline deal stage transitions", () => {
  it("drag/drop into Won persists won status and updates the KPI immediately", () => {
    const transition = createDealStageTransition(stages[2], "open", thisMonth);
    expect(transition).toEqual({
      stage_id: "won",
      status: "won",
      updated_at: thisMonth,
    });
    expect(calculatePipelineMetrics(stages, [deal(transition)], now).wonThisMonth).toBe(1);
  });

  it("direct stage editing into Won persists the same won transition", () => {
    const transition = createDealStageTransition(stages[2], "open", thisMonth);
    const editedDeal = deal({ title: "Direct edit", ...transition });
    expect(editedDeal.status).toBe("won");
    expect(calculatePipelineMetrics(stages, [editedDeal], now).wonThisMonth).toBe(1);
  });

  it("direct Mark as Won moves the deal into the Won column", () => {
    expect(createDealStatusTransition("won", stages, "negotiation", thisMonth)).toEqual({
      stage_id: "won",
      status: "won",
      updated_at: thisMonth,
    });
  });

  it("reopening a won deal moves it back to the latest open stage", () => {
    expect(createDealStatusTransition("open", stages, "won", thisMonth)).toEqual({
      stage_id: "negotiation",
      status: "open",
      updated_at: thisMonth,
    });
    expect(createDealStageTransition(stages[0], "won", thisMonth).status).toBe("open");
  });
});

describe("pipeline monthly and existing metrics", () => {
  it("counts a legacy Won-column/open-status deal while older records are repaired", () => {
    expect(
      calculatePipelineMetrics(stages, [deal({ stage_id: "won", status: "open" })], now)
        .wonThisMonth,
    ).toBe(1);
  });

  it("counts only wins inside the current month", () => {
    const wonDeals = [
      deal({ id: "current", status: "won", stage_id: "won" }),
      deal({
        id: "previous",
        status: "won",
        stage_id: "won",
        updated_at: new Date(2026, 6, 31, 23, 59).toISOString(),
      }),
      deal({
        id: "future",
        status: "won",
        stage_id: "won",
        updated_at: new Date(2026, 8, 1).toISOString(),
      }),
    ];
    expect(calculatePipelineMetrics(stages, wonDeals, now).wonThisMonth).toBe(1);
  });

  it("preserves total value, average, weighted value, and lost-this-month metrics", () => {
    const deals = [
      deal({ id: "new", value: 1000 }),
      deal({ id: "negotiation", stage_id: "negotiation", value: 2000 }),
      deal({ id: "won", stage_id: "won", status: "won", value: 3000 }),
      deal({ id: "lost", status: "lost", value: 9000 }),
    ];

    expect(calculatePipelineMetrics(stages, deals, now)).toEqual({
      totalCount: 3,
      totalValue: 6000,
      avgValue: 2000,
      weightedValue: 1900,
      wonThisMonth: 1,
      lostThisMonth: 1,
    });
  });

  it("does not count a lost deal placed in the Won column as a win", () => {
    const metrics = calculatePipelineMetrics(
      stages,
      [deal({ stage_id: "won", status: "lost" })],
      now,
    );
    expect(metrics.wonThisMonth).toBe(0);
    expect(metrics.lostThisMonth).toBe(1);
  });
});
