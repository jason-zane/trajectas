import {
  getConstructsForSelect,
  getResponseFormats,
} from "@/app/actions/items";
import { ItemForm } from "../item-form";

export default async function CreateItemPage({
  searchParams,
}: {
  searchParams: Promise<{ constructSlug?: string }>
}) {
  const { constructSlug } = await searchParams;
  const [constructs, responseFormats] = await Promise.all([
    getConstructsForSelect(),
    getResponseFormats(),
  ]);

  // Pre-select construct if slug provided
  const preselectedConstruct = constructSlug
    ? constructs.find((c) => c.slug === constructSlug)
    : undefined;

  const returnTo = constructSlug
    ? `/constructs/${constructSlug}/edit`
    : undefined;

  return (
    <ItemForm
      constructs={constructs}
      responseFormats={responseFormats}
      mode="create"
      returnTo={returnTo}
      initialData={
        preselectedConstruct
          ? {
              constructId: preselectedConstruct.id,
              responseFormatId: "",
              stem: "",
              reverseScored: false,
              status: "draft",
              displayOrder: 0,
            }
          : undefined
      }
    />
  );
}
