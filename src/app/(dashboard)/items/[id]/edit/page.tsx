import { notFound } from "next/navigation";
import {
  getItemById,
  getConstructsForSelect,
  getResponseFormats,
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
  const [item, constructs, responseFormats] = await Promise.all([
    getItemById(id),
    getConstructsForSelect(),
    getResponseFormats(),
  ]);

  if (!item) notFound();

  return (
    <ItemForm
      constructs={constructs}
      responseFormats={responseFormats}
      mode="edit"
      itemId={id}
      returnTo={returnTo}
      initialData={{
        constructId: item.constructId,
        responseFormatId: item.responseFormatId,
        stem: item.stem,
        reverseScored: item.reverseScored,
        status: item.status,
        displayOrder: item.displayOrder,
      }}
    />
  );
}
