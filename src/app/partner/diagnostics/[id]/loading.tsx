import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton";
import { Shimmer } from "@/components/loading/shimmer";

// Generic portal-page shape (WorkspacePortalLivePage): header + content card.
export default function PartnerDiagnosticDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Shimmer className="h-[480px] w-full rounded-xl" />
    </div>
  );
}
