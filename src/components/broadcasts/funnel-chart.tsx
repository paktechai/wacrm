export interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

/**
 * A themed contrast chip keeps values inside the bar without relying on the
 * colored fill for contrast. This also stays readable when a 0% fill is much
 * narrower than the label. Existing percentage, width and color rules stay put.
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
              className="grid min-w-0 grid-cols-1 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-y-0"
            >
              <span className="min-w-0 truncate text-xs font-medium text-foreground">
                {step.label}
              </span>

              <div
                aria-label={`${step.label}: ${step.value.toLocaleString()} (${pctOfSent}%)`}
                className="relative h-8 min-w-0 overflow-hidden rounded-full bg-muted sm:col-start-2 sm:row-start-1"
              >
                <div
                  className={`h-8 rounded-full ${step.color} transition-[width] duration-500`}
                  style={{ width: `${pctOfMax}%` }}
                />

                <span className="absolute inset-y-1 left-1 inline-flex max-w-[calc(100%-0.5rem)] items-center gap-1.5 whitespace-nowrap rounded-full bg-background/85 px-2.5 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur-sm tabular-nums sm:px-3 sm:text-xs">
                  <span className="font-semibold">{step.value.toLocaleString()}</span>
                  <span>({pctOfSent}%)</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
