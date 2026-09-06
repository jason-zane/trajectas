import { connection } from "next/server"
import {
  getDimensionsForSelect,
  getConstructsForSelect,
  getClientsForFactorSelect,
} from "@/app/actions/factors";
import { getContentSources } from "@/app/actions/content-sources";
import { getLibraryCategories } from "@/app/actions/categories";
import { FactorForm } from "../factor-form";

export default async function CreateFactorPage() {
  await connection()
  const [dimensions, constructs, clients, contentSources, categories] = await Promise.all([
    getDimensionsForSelect(),
    getConstructsForSelect(),
    getClientsForFactorSelect(),
    getContentSources(),
    getLibraryCategories(),
  ]);

  return (
    <FactorForm
      dimensions={dimensions}
      availableConstructs={constructs}
      clients={clients}
      categories={categories}
      contentSources={contentSources}
      mode="create"
    />
  );
}
