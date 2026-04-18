"use client";

import { useMemo } from "react";

interface SparklineProps {
  /** Ordered values, oldest to newest. */
  values: number[];
  width?: number;
  height?: number;
  /** Stroke colour, falls back to emerald. */
  stroke?: string;
  /** Fill under the line; pass null to disable. */
  fill?: string | null;
  className?: string;
}

/**
 * Dead-simple inline-SVG sparkline. Not a charting library — just enough
 * to make a stat feel alive. No axes, no tooltips, no gridlines.
 */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  stroke = "var(--emerald)",
  fill = "var(--emerald)",
  className,
}: SparklineProps) {
  const { pathD, areaD } = useMemo(() => {
    if (values.length === 0) {
      return { pathD: "", areaD: "" };
    }
    const max = Math.max(...values, 1);
    const min = 0;
    const range = max - min || 1;
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    const padY = 2;
    const innerH = height - padY * 2;

    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = padY + innerH - ((v - min) / range) * innerH;
      return [x, y] as const;
    });

    const lineD = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ");
    const area = `${lineD} L${width.toFixed(2)} ${height} L0 ${height} Z`;

    return { pathD: lineD, areaD: area };
  }, [values, width, height]);

  if (!pathD) {
    return null;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {fill && (
        <path
          d={areaD}
          fill={fill}
          fillOpacity={0.08}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
