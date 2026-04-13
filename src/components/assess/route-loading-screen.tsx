export function RouteLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div
        className="size-10 animate-spin rounded-full border-2 border-t-transparent"
        style={{
          borderColor: "var(--brand-primary, hsl(var(--primary) / 0.2))",
          borderTopColor: "transparent",
        }}
      />
    </div>
  )
}
