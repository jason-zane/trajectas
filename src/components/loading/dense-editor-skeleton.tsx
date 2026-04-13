function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
      style={style}
    />
  );
}

interface DenseEditorSkeletonProps {
  className?: string;
}

export function DenseEditorSkeleton({ className }: DenseEditorSkeletonProps) {
  return (
    <div className={`flex h-screen flex-col bg-background${className ? ` ${className}` : ""}`}>
      {/* Header Toolbar */}
      <div className="flex items-center gap-2 border-b border-foreground/[0.06] bg-muted/30 px-4 py-3">
        {/* Toolbar buttons */}
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-8 w-8 rounded-md"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
        <div className="flex-1" />
        {/* Right-side toolbar buttons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={`right-${i}`}
            className="h-8 w-8 rounded-md"
            style={{ animationDelay: `${240 + i * 40}ms` }}
          />
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="flex w-64 flex-col border-r border-foreground/[0.06] bg-muted/20 px-4 py-4">
          {/* Sidebar header */}
          <Skeleton className="mb-4 h-6 w-32" style={{ animationDelay: "320ms" }} />

          {/* Sidebar items */}
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton
                  className="h-4 w-24"
                  style={{ animationDelay: `${360 + i * 60}ms` }}
                />
                <Skeleton
                  className="h-3 w-20"
                  style={{ animationDelay: `${380 + i * 60}ms` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Editor Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Content Header */}
          <div className="border-b border-foreground/[0.06] px-6 py-4">
            <Skeleton className="h-8 w-48" style={{ animationDelay: "660ms" }} />
            <Skeleton className="mt-2 h-4 w-96" style={{ animationDelay: "700ms" }} />
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              {/* Content lines */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton
                    className="h-4 w-full"
                    style={{ animationDelay: `${740 + i * 60}ms` }}
                  />
                  {i % 3 === 2 && (
                    <Skeleton
                      className="h-4 w-3/4"
                      style={{ animationDelay: `${760 + i * 60}ms` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar / Properties Panel */}
        <div className="flex w-80 flex-col border-l border-foreground/[0.06] bg-muted/20 px-4 py-4">
          {/* Properties header */}
          <Skeleton className="mb-4 h-6 w-32" style={{ animationDelay: "1200ms" }} />

          {/* Properties groups */}
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, groupIdx) => (
              <div key={groupIdx} className="space-y-3">
                <Skeleton
                  className="h-5 w-28"
                  style={{ animationDelay: `${1240 + groupIdx * 120}ms` }}
                />
                {Array.from({ length: 3 }).map((_, itemIdx) => (
                  <div key={itemIdx} className="space-y-1.5">
                    <Skeleton
                      className="h-4 w-20"
                      style={{
                        animationDelay: `${1260 + groupIdx * 120 + itemIdx * 40}ms`,
                      }}
                    />
                    <Skeleton
                      className="h-8 w-full"
                      style={{
                        animationDelay: `${1280 + groupIdx * 120 + itemIdx * 40}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
