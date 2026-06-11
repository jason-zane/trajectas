import { FormPageLoading } from "@/components/page-loading";

/**
 * Shared skeleton for compare pages (campaigns and participants compare).
 * Used by 4 pages across dashboard and client portals.
 */
export function CompareSkeleton() {
  return <FormPageLoading className="max-w-7xl" fieldCount={3} />;
}
