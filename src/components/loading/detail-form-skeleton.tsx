function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
      style={style}
    />
  );
}

interface FieldRowProps {
  columns?: number;
  delayStart?: number;
}

function FieldRow({ columns = 2, delayStart = 0 }: FieldRowProps) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="space-y-2" style={{ animationDelay: `${delayStart + i * 40}ms` }}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

interface DetailFormSkeletonProps {
  sections?: number;
  fieldsPerSection?: number;
  className?: string;
}

export function DetailFormSkeleton({ sections = 2, fieldsPerSection = 2, className }: DetailFormSkeletonProps) {
  return (
    <div className={`max-w-4xl mx-auto space-y-10${className ? ` ${className}` : ""}`}>
      {/* Form Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" style={{ animationDelay: "0ms" }} />
        <Skeleton className="h-4 w-96" style={{ animationDelay: "80ms" }} />
      </div>

      {/* Form Sections */}
      {Array.from({ length: sections }).map((_, sectionIdx) => {
        const baseDelay = (sectionIdx + 1) * 160;
        return (
          <div key={sectionIdx} className="space-y-5">
            {/* Section Header */}
            <div className="space-y-1">
              <Skeleton
                className="h-6 w-32"
                style={{ animationDelay: `${baseDelay}ms` }}
              />
              <Skeleton
                className="h-3 w-64"
                style={{ animationDelay: `${baseDelay + 40}ms` }}
              />
            </div>

            {/* Section Fields */}
            {Array.from({ length: fieldsPerSection }).map((_, fieldIdx) => (
              <FieldRow
                key={fieldIdx}
                columns={2}
                delayStart={baseDelay + 80 + fieldIdx * 120}
              />
            ))}
          </div>
        );
      })}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4" style={{ animationDelay: `${sections * 320}ms` }}>
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}
