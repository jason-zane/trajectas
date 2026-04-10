export default function BlockBuilderLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-shimmer flex-col">
      <div className="h-14 border-b border-border bg-card" />
      <div className="flex flex-1">
        <div className="w-56 border-r border-border bg-card" />
        <div className="flex-1 bg-background" />
        <div className="w-72 border-l border-border bg-card" />
      </div>
    </div>
  );
}
