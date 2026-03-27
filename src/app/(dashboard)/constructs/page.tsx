import { getConstructs } from "@/app/actions/constructs";
import { getConstructAlphaIndicators } from "@/app/actions/psychometrics";
import { ConstructList } from "./construct-list";

export default async function ConstructsPage() {
  const [constructs, indicators] = await Promise.all([
    getConstructs(),
    getConstructAlphaIndicators(),
  ]);

  // Build a lookup map for the client component
  const alphaMap: Record<string, number | null> = {};
  for (const ind of indicators) {
    alphaMap[ind.constructId] = ind.alpha;
  }

  return <ConstructList constructs={constructs} alphaMap={alphaMap} />;
}
