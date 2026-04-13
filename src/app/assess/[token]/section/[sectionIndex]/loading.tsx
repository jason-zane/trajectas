import { RouteLoadingScreen } from "@/components/assess/route-loading-screen";

export default function SectionLoading() {
  return (
    <RouteLoadingScreen
      eyebrow="Assessment"
      title="Loading the next section"
      description="Restoring your progress and preparing the next questions."
      variant="pulse"
    />
  );
}
