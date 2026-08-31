import type { Deal, DealStatus, PipelineStage } from "@/types";

export interface PipelineMetrics {
  totalCount: number;
  totalValue: number;
  avgValue: number;
  weightedValue: number;
  wonThisMonth: number;
  lostThisMonth: number;
}

function terminalStageStatus(stage?: Pick<PipelineStage, "name">): DealStatus | null {
  const name = stage?.name.trim().toLowerCase();
  if (name === "won" || name === "closed won") return "won";
  if (name === "lost" || name === "closed lost") return "lost";
  return null;
}

export function createDealStageTransition(
  stage: PipelineStage,
  currentStatus: DealStatus = "open",
  changedAt = new Date().toISOString(),
): Pick<Deal, "stage_id" | "status" | "updated_at"> {
  return {
    stage_id: stage.id,
    status:
      terminalStageStatus(stage) ??
      (currentStatus === "won" || currentStatus === "lost" ? "open" : currentStatus),
    updated_at: changedAt,
  };
}

export function createDealStatusTransition(
  status: DealStatus,
  stages: PipelineStage[],
  currentStageId: string,
  changedAt = new Date().toISOString(),
): Pick<Deal, "stage_id" | "status" | "updated_at"> {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const currentStage = sortedStages.find((stage) => stage.id === currentStageId);
  const targetStage =
    status === "open" && terminalStageStatus(currentStage)
      ? [...sortedStages].reverse().find((stage) => !terminalStageStatus(stage))
      : sortedStages.find((stage) => terminalStageStatus(stage) === status);

  return {
    stage_id: targetStage?.id ?? currentStageId,
    status,
    updated_at: changedAt,
  };
}

export function calculatePipelineMetrics(
  stages: PipelineStage[],
  deals: Deal[],
  now = new Date(),
): PipelineMetrics {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const stageById = new Map(sortedStages.map((stage) => [stage.id, stage]));
  const effectiveStatus = (deal: Deal): DealStatus =>
    deal.status === "lost"
      ? "lost"
      : terminalStageStatus(stageById.get(deal.stage_id)) === "won"
        ? "won"
        : deal.status ?? "open";

  const active = deals.filter((deal) => effectiveStatus(deal) !== "lost");
  const openDeals = active.filter((deal) => effectiveStatus(deal) !== "won");
  const totalCount = active.length;
  const totalValue = active.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const avgValue = totalCount > 0 ? totalValue / totalCount : 0;
  const weightedValue = openDeals.reduce((sum, deal) => {
    const stage = stageById.get(deal.stage_id);
    if (!stage) return sum;
    const index = sortedStages.findIndex((candidate) => candidate.id === stage.id);
    const slots = sortedStages.length - 1;
    const probability =
      sortedStages.length <= 1 || index === slots
        ? 1
        : slots <= 1
          ? 0.1
          : 0.1 + (index / (slots - 1)) * 0.8;
    return sum + Number(deal.value || 0) * probability;
  }, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const isThisMonth = (deal: Deal) => {
    const timestamp = deal.updated_at ?? deal.created_at;
    if (!timestamp) return false;
    const date = new Date(timestamp);
    return date >= monthStart && date < nextMonthStart;
  };

  return {
    totalCount,
    totalValue,
    avgValue,
    weightedValue,
    wonThisMonth: deals.filter(
      (deal) => effectiveStatus(deal) === "won" && isThisMonth(deal),
    ).length,
    lostThisMonth: deals.filter(
      (deal) => effectiveStatus(deal) === "lost" && isThisMonth(deal),
    ).length,
  };
}
