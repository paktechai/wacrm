export interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

/**
 * Keep labels and values on the themed card surface instead of painting text
 * over differently colored bars. The percentage/width calculations and bar
 * colors intentionally match the existing broadcast analytics exactly.
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((step) => step.value), 1);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">Funnel</h3>
      <div className="space-y-3 sm:space-y-2">
        {steps.map((step) => {
          const pctOfMax = Math.max(5, Math.round((step.value / max) * 100));
          const pctOfSent =
            steps[0].value > 0
              ? Math.round((step.value / steps[0].value) * 100)
              : 0;

          return (
            <div
              key={step.label}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-y-0"
            >
              <span className="min-w-0 truncate text-xs font-medium text-foreground">
                {step.label}
              </span>

              <div
                aria-label={`${step.label}: ${step.value.toLocaleString()} (${pctOfSent}%)`}
                className="col-span-2 row-start-2 h-7 min-w-0 overflow-hidden rounded-full bg-muted sm:col-span-1 sm:col-start-2 sm:row-start-1"
              >
                <div
                  className={`h-7 rounded-full ${step.color} transition-[width] duration-500`}
                  style={{ width: `${pctOfMax}%` }}
                />
              </div>

              <span className="col-start-2 row-start-1 flex items-baseline gap-1.5 whitespace-nowrap text-xs text-foreground tabular-nums sm:col-start-3">
                <span className="font-semibold">{step.value.toLocaleString()}</span>
                <span className="font-medium">({pctOfSent}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
