import { RouteLoadingScreen } from "@/components/assess/route-loading-screen";

export default function AssessmentIntroLoading() {
  return (
    <RouteLoadingScreen
      eyebrow="Next assessment"
      title="Loading the next assessment"
      description="Preparing the assessment overview and getting your place ready."
      variant="spinner"
    />
  );
}
