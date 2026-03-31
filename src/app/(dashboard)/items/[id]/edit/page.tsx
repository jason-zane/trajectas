import { notFound } from "next/navigation";
import {
  getItemById,
  getConstructsForSelect,
  getResponseFormats,
  getItemParameters,
  getItemOptions,
} from "@/app/actions/items";
import { ItemForm } from "../../item-form";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const [item, constructs, responseFormats, irtParameters, options] = await Promise.all([
    getItemById(id),
    getConstructsForSelect(),
    getResponseFormats(),
    getItemParameters(id),
    getItemOptions(id),
  ]);

  if (!item) notFound();

  return (
    <ItemForm
      constructs={constructs}
      responseFormats={responseFormats}
      mode="edit"
      itemId={id}
      returnTo={returnTo}
      irtParameters={irtParameters}
      initialOptions={options}
      initialData={{
        purpose: item.purpose,
        constructId: item.constructId,
        responseFormatId: item.responseFormatId,
        stem: item.stem,
        reverseScored: item.reverseScored,
        weight: item.weight,
        status: item.status,
        displayOrder: item.displayOrder,
        selectionPriority: item.selectionPriority,
        keyedAnswer: item.keyedAnswer,
      }}
    />
  );
}
