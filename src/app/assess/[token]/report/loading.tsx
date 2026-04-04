export default function ReportLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading your report...</p>
      </div>
    </div>
  )
}
