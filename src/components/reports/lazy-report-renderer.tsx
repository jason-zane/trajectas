"use client";

import dynamic from "next/dynamic";
import type { ResolvedBlockData } from "@/lib/reports/types";

const ReportRenderer = dynamic(
  () =>
    import("@/components/reports/report-renderer").then(
      (mod) => mod.ReportRenderer,
    ),
  {
    loading: () => (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-muted/30"
          />
        ))}
      </div>
    ),
  },
);

export function LazyReportRenderer({ blocks }: { blocks: ResolvedBlockData[] }) {
  return <ReportRenderer blocks={blocks} />;
}
