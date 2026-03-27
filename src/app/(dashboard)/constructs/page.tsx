import { getConstructs } from "@/app/actions/constructs";
import { ConstructList } from "./construct-list";

export default async function ConstructsPage() {
  const constructs = await getConstructs();
  return <ConstructList constructs={constructs} />;
}
