import { getItemsForBlockSelect } from "@/app/actions/forced-choice-blocks";
import { BlockForm } from "../block-form";

export default async function CreateBlockPage() {
  const itemOptions = await getItemsForBlockSelect();

  return <BlockForm mode="create" itemOptions={itemOptions} />;
}
