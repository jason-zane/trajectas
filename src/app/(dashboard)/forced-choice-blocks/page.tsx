import { getForcedChoiceBlocks } from "@/app/actions/forced-choice-blocks";
import { BlockList } from "./block-list";

export default async function ForcedChoiceBlocksPage() {
  const blocks = await getForcedChoiceBlocks();

  return <BlockList blocks={blocks} />;
}
