export default function PublicBuildDetailLoading() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="h-4 w-24 rounded bg-muted/40 animate-shimmer" />
      <div className="h-10 w-64 rounded bg-muted/40 animate-shimmer" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 rounded-lg border bg-muted/40 animate-shimmer" />
      ))}
    </div>
  );
}
