import { RouteLoadingScreen } from "@/components/assess/route-loading-screen";

export default function ReportLoading() {
  return (
    <RouteLoadingScreen
      eyebrow="Results"
      title="Loading your report"
      description="Pulling together your results and the latest report state."
      variant="spinner"
    />
  );
}
