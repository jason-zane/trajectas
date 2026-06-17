import type { SeriesPoint } from "@/lib/business/finance-helpers";

/**
 * Compact monthly bar chart for usage / revenue over time. Dependency-free
 * (matches the in-house chart convention); bars scale to the series max.
 */
export function UsageTrendChart({
  data,
  formatValue,
  emptyLabel = "No activity yet",
}: {
  data: SeriesPoint[];
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const PLOT = 120;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-end gap-1.5" style={{ height: PLOT }}>
        {data.map((d) => (
          <div
            key={d.key}
            className="flex h-full flex-1 flex-col items-center justify-end"
            title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}
          >
            <div
              className="w-full max-w-[28px] rounded-t bg-primary"
              style={{ height: Math.round((d.value / max) * PLOT), minHeight: d.value > 0 ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <div key={d.key} className="flex-1 text-center text-[10px] text-muted-foreground">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
