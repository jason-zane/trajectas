"use client";

interface ProgressBarProps {
  sectionIndex: number;
  totalSections: number;
  itemIndex: number;
  totalItems: number;
}

export function ProgressBar({
  sectionIndex,
  totalSections,
  itemIndex,
  totalItems,
}: ProgressBarProps) {
  const overallPct =
    totalSections > 0
      ? Math.round(((sectionIndex + (totalItems > 0 ? itemIndex / totalItems : 0)) / totalSections) * 100)
      : 0;

  const sectionPct =
    totalItems > 0 ? Math.round((itemIndex / totalItems) * 100) : 0;

  return (
    <div className="space-y-2">
      {/* Overall progress */}
      <div className="h-1 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      {/* Section label */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Section {sectionIndex + 1} of {totalSections}
        </span>
        {totalItems > 0 && (
          <span>
            Question {Math.min(itemIndex + 1, totalItems)} of {totalItems}
          </span>
        )}
      </div>
    </div>
  );
}
