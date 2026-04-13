import { RouteLoadingScreen } from "@/components/assess/route-loading-screen";

export default function ReviewLoading() {
  return (
    <RouteLoadingScreen
      eyebrow="Review"
      title="Loading your assessment review"
      description="Restoring your answers and preparing the final review step."
      variant="spinner"
    />
  );
}
