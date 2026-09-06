import type {
  OutcomeMetricResult,
  OutcomePredictor,
} from "@/lib/outcomes/types";
export function OutcomeEffectPlot({
  result,
  predictors,
}: {
  result: OutcomeMetricResult;
  predictors: OutcomePredictor[];
}) {
  const rows = result.findings
    .filter((f) => f.adjustedPerSd)
    .sort(
      (a, b) =>
        Math.abs(b.adjustedPerSd!.value) - Math.abs(a.adjustedPerSd!.value),
    );
  if (!rows.length) return null;
  const low = Math.min(0, ...rows.map((r) => r.adjustedPerSd!.lower)),
    high = Math.max(0, ...rows.map((r) => r.adjustedPerSd!.upper)),
    pad = (high - low) * 0.08 || 1,
    min = low - pad,
    max = high + pad;
  const x = (value: number) => ((value - min) / (max - min)) * 100;
  return (
    <figure className="mb-7">
      <figcaption>
        <p className="text-sm font-semibold">
          Compare relationships on a common score scale
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Adjusted KPI coefficient for a one-standard-deviation higher
          capability score. Lines show 95% intervals. Magnitudes help compare
          associations; they do not establish a precise ranking or a development
          effect.
          {result.model.method.startsWith("Logistic")
            ? " Values use log odds."
            : result.model.method.startsWith("Poisson")
              ? " Values use log rates."
              : ""}
        </p>
      </figcaption>
      <div className="mt-5 space-y-4">
        {rows.map((row) => {
          const e = row.adjustedPerSd!;
          return (
            <div
              key={row.predictorId}
              className="grid items-center gap-2 sm:grid-cols-[180px_1fr_65px]"
            >
              <span className="text-xs font-medium">
                {predictors.find((p) => p.id === row.predictorId)?.label}
              </span>
              <div
                className="relative h-7"
                role="img"
                aria-label={`Adjusted coefficient ${e.value.toFixed(2)}, interval ${e.lower.toFixed(2)} to ${e.upper.toFixed(2)}`}
              >
                <div
                  className="absolute inset-y-0 w-px border-l border-dashed border-muted-foreground"
                  style={{ left: `${x(0)}%` }}
                />
                <div
                  className={`absolute top-3 h-1 ${row.status === "supported" ? "bg-primary" : "bg-muted-foreground/60"}`}
                  style={{
                    left: `${x(e.lower)}%`,
                    width: `${x(e.upper) - x(e.lower)}%`,
                  }}
                />
                <div
                  className={`absolute top-2 size-3 -translate-x-1/2 rounded-full ${row.status === "supported" ? "bg-primary" : "bg-muted-foreground"}`}
                  style={{ left: `${x(e.value)}%` }}
                />
              </div>
              <span className="text-right font-mono text-xs tabular-nums">
                {e.value.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid text-xs text-muted-foreground sm:grid-cols-[180px_1fr_65px]">
        <span />
        <div className="relative h-5">
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${x(0)}%` }}
          >
            0 · no relationship
          </span>
        </div>
      </div>
    </figure>
  );
}
