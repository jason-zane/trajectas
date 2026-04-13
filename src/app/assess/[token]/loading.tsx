import { RouteLoadingScreen } from "@/components/assess/route-loading-screen";

export default function AssessLoading() {
  return (
    <RouteLoadingScreen
      eyebrow="Preparing"
      title="Loading your assessment"
      description="Pulling in your next step and restoring your progress."
      variant="pulse"
    />
  );
}
