import { RouteLoadingScreen } from "@/components/assess/route-loading-screen";

export default function WelcomeLoading() {
  return (
    <RouteLoadingScreen
      eyebrow="Welcome"
      title="Loading your welcome page"
      description="Pulling in the campaign details and restoring your entry point."
      variant="pulse"
    />
  );
}
