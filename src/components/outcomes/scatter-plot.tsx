"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { OutcomePlotPoint } from "@/lib/outcomes/types";
import { statistic } from "@/lib/outcomes/analysis";
import { Button } from "@/components/ui/button";

function domain(values: number[]) {
  const minimum = Math.min(...values),
    maximum = Math.max(...values),
    padding =
      (maximum - minimum) * 0.08 || Math.max(Math.abs(minimum) * 0.08, 1);
  return [minimum - padding, maximum + padding] as const;
}
function ticks(low: number, high: number, count: number) {
  const step = (high - low) / count,
    power = 10 ** Math.floor(Math.log10(step));
  const spacing = [1, 2, 2.5, 5, 10].find((v) => v * power >= step)! * power;
  const result: number[] = [];
  for (
    let n = Math.ceil(low / spacing) * spacing;
    n <= high + spacing * 0.001;
    n += spacing
  )
    result.push(Math.abs(n) < spacing * 0.001 ? 0 : n);
  return result;
}
export function OutcomeScatterPlot({
  points,
  xLabel,
  yLabel,
  total,
  zeroLine = false,
  trend,
}: {
  points: OutcomePlotPoint[];
  xLabel: string;
  yLabel: string;
  total: number;
  zeroLine?: boolean;
  trend?: { slope: number; intercept: number } | null;
}) {
  const instructionsId = useId();
  const host = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(600);
  const [selected, setSelected] = useState<number | null>(null),
    [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  if (!points.length)
    return (
      <p className="text-sm text-muted-foreground">
        Plot observations are unavailable for this run. Run the analysis again
        to include plots.
      </p>
    );
  const height = 320,
    left = 72,
    right = Math.max(left + 20, width - 18),
    top = 16,
    bottom = height - 65;
  const xDomain = domain(points.map((p) => p.x));
  const trendPoints = trend
    ? [
        Math.min(...points.map((p) => p.x)),
        Math.max(...points.map((p) => p.x)),
      ].map((x) => ({ x, y: trend.intercept + trend.slope * x }))
    : [];
  const yDomain = domain([
    ...points.map((p) => p.y),
    ...trendPoints.map((p) => p.y),
    ...(zeroLine ? [0] : []),
  ]);
  const x = (v: number) =>
    left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * (right - left);
  const y = (v: number) =>
    bottom - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * (bottom - top);
  const tick = (v: number) =>
    new Intl.NumberFormat("en-AU", {
      notation: Math.abs(v) >= 10000 ? "compact" : "standard",
      maximumFractionDigits: 2,
    }).format(v);
  const point = selected === null ? null : points[selected];
  const locate = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect(),
      px = event.clientX - box.left,
      py = event.clientY - box.top;
    if (px < left || px > right || py < top || py > bottom) return null;
    let index = 0,
      distance = Infinity;
    points.forEach((p, i) => {
      const d = (x(p.x) - px) ** 2 + (y(p.y) - py) ** 2;
      if (d < distance) {
        distance = d;
        index = i;
      }
    });
    return index;
  };
  return (
    <figure className="min-w-0">
      <div ref={host} className="relative min-w-0">
        <svg
          className="block w-full touch-pan-y"
          viewBox={`0 0 ${width} ${height}`}
          height={height}
          role="img"
          tabIndex={0}
          aria-describedby={instructionsId}
          onKeyDown={(event) => {
            const keys = [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "Escape",
            ];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            if (event.key === "Escape") {
              setSelected(null);
              setPinned(false);
              return;
            }
            setPinned(true);
            setSelected((current) =>
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? points.length - 1
                  : current === null
                    ? 0
                    : (current +
                        (["ArrowLeft", "ArrowUp"].includes(event.key)
                          ? -1
                          : 1) +
                        points.length) %
                      points.length,
            );
          }}
          aria-label={`${yLabel} against ${xLabel}; ${points.length} plotted observations from ${total} eligible people.`}
          onPointerMove={(event) => {
            if (!pinned) setSelected(locate(event));
          }}
          onPointerLeave={() => {
            if (!pinned) setSelected(null);
          }}
          onPointerDown={(event) => {
            const index = locate(event);
            if (index !== null) {
              setSelected(index);
              setPinned(!(pinned && selected === index));
            }
          }}
        >
          <rect
            x={left}
            y={top}
            width={right - left}
            height={bottom - top}
            fill="none"
            stroke="var(--border)"
          />
          {ticks(...xDomain, width < 450 ? 4 : 5).map((v) => (
            <g key={v}>
              <line
                x1={x(v)}
                x2={x(v)}
                y1={bottom}
                y2={bottom + 4}
                stroke="var(--border)"
              />
              <text
                x={x(v)}
                y={bottom + 20}
                textAnchor="middle"
                className="fill-muted-foreground text-xs"
              >
                {tick(v)}
              </text>
            </g>
          ))}
          {ticks(...yDomain, 4).map((v) => (
            <g key={v}>
              <line
                x1={left - 4}
                x2={left}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border)"
              />
              <text
                x={left - 9}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-xs"
              >
                {tick(v)}
              </text>
            </g>
          ))}
          {zeroLine && (
            <line
              x1={left}
              x2={right}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
            />
          )}
          {trendPoints.length === 2 && (
            <line
              x1={x(trendPoints[0].x)}
              y1={y(trendPoints[0].y)}
              x2={x(trendPoints[1].x)}
              y2={y(trendPoints[1].y)}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
            />
          )}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(p.x)}
              cy={y(p.y)}
              r={3.2}
              fill="var(--primary)"
              opacity={0.65}
            />
          ))}
          {point && (
            <circle
              cx={x(point.x)}
              cy={y(point.y)}
              r={5}
              fill="var(--primary)"
              stroke="var(--background)"
              strokeWidth={2}
            />
          )}
          <text
            x={(left + right) / 2}
            y={height - 15}
            textAnchor="middle"
            className="fill-foreground text-xs"
          >
            {xLabel.length > 35 ? "Capability score" : xLabel}
          </text>
          <text
            transform={`translate(16 ${(top + bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-foreground text-xs"
          >
            {yLabel.length > 35 ? "Business outcome" : yLabel}
          </text>
        </svg>
        {point && (
          <div
            role="tooltip"
            className="pointer-events-none absolute right-3 top-2 max-w-60 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          >
            <p>
              {xLabel}: {statistic(point.x)}
            </p>
            <p>
              {yLabel}: {statistic(point.y)}
            </p>
          </div>
        )}
      </div>
      <figcaption
        id={instructionsId}
        className="text-xs leading-relaxed text-muted-foreground"
      >
        {points.length < total
          ? `${points.length} observations from a deterministic sample of up to 240 people; all ${total} eligible observations enter the statistics.`
          : `${points.length} observations. All eligible observations enter the statistics.`}{" "}
        Tap a point or focus the chart and use arrow keys to inspect values.
        Press Escape to clear.
        {trend &&
          " Dashed line: unadjusted trend fitted to all eligible pairs."}
      </figcaption>
      <p className="sr-only" aria-live="polite">
        {point
          ? `${xLabel}: ${statistic(point.x)}. ${yLabel}: ${statistic(point.y)}.`
          : "No point selected."}
      </p>
      {pinned && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPinned(false);
            setSelected(null);
          }}
        >
          Clear selected point
        </Button>
      )}
    </figure>
  );
}
