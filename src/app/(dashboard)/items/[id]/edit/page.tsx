import { notFound } from "next/navigation";
import {
  getItemById,
  getConstructsForSelect,
  getFactorsForSelect,
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
  const [item, constructs, factors, responseFormats] = await Promise.all([
    getItemById(id),
    getConstructsForSelect(),
    getFactorsForSelect(),
    getResponseFormats(),
  ]);

  if (!item) notFound();

  return (
    <ItemForm
      constructs={constructs}
      factors={factors}
      responseFormats={responseFormats}
      mode="edit"
      itemId={id}
      returnTo={returnTo}
      initialData={{
        traitId: item.traitId,
        competencyId: item.competencyId,
        responseFormatId: item.responseFormatId,
        stem: item.stem,
        reverseScored: item.reverseScored,
        status: item.status,
        displayOrder: item.displayOrder,
        options: item.options,
        rubrics: (item.rubrics ?? []).map((rb: { rubricLabel: string; scoreValue: number; explanation?: string }, i: number) => ({
          optionIndex: i,
          rubricLabel: rb.rubricLabel as "best" | "good" | "neutral" | "poor",
          scoreValue: rb.scoreValue,
          explanation: rb.explanation,
        })),
      }}
    />
  );
}
