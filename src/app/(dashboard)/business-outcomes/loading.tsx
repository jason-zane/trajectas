import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton";
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeaderSkeleton eyebrow description />
      <div className="h-12 rounded-lg bg-muted animate-shimmer" />
      <div className="h-80 rounded-xl bg-muted animate-shimmer" />
    </div>
  );
}
