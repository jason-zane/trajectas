import { notFound } from "next/navigation";
import {
  getBlockById,
  getItemsForBlockSelect,
} from "@/app/actions/forced-choice-blocks";
import { BlockForm } from "../../block-form";

export default async function EditBlockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [block, itemOptions] = await Promise.all([
    getBlockById(id),
    getItemsForBlockSelect(),
  ]);

  if (!block) notFound();

  return (
    <BlockForm
      mode="edit"
      blockId={id}
      itemOptions={itemOptions}
      initialData={{
        name: block.name,
        description: block.description ?? "",
        items: block.items,
      }}
    />
  );
}
