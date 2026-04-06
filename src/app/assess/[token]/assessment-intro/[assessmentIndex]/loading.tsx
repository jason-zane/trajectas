function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function AssessmentIntroLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header shimmer */}
      <header className="flex h-14 items-center px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>
      </header>

      {/* Main content shimmer */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] space-y-6">
          {/* Heading shimmer */}
          <div className="flex flex-col items-center space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          {/* Button shimmer */}
          <div className="flex justify-center">
            <Skeleton className="h-11 w-[200px] rounded-xl" />
          </div>
        </div>
      </main>

      {/* Footer shimmer */}
      <footer className="flex items-center justify-center px-4 py-4">
        <Skeleton className="h-3 w-48" />
      </footer>
    </div>
  )
}
