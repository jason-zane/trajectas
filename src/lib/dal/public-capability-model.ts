import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ArchitectEligibleFactor } from "@/types/architect";

/** Public, platform-wide reference content only. Never exposes items, keys or tenant data. */
export async function getPublicCapabilityModel(): Promise<ArchitectEligibleFactor[]> {
  // Explicit development preview only; never a fallback for a failing live library.
  if (process.env.NODE_ENV === "development" && process.env.PUBLIC_CAPABILITY_MODEL_SNAPSHOT) {
    const { readFile } = await import("node:fs/promises");
    const data: unknown = JSON.parse(await readFile(process.env.PUBLIC_CAPABILITY_MODEL_SNAPSHOT, "utf8"));
    if (!Array.isArray(data) || !data.every(row => row && typeof row.factorId === "string" && typeof row.factorName === "string")) {
      throw new Error("Invalid development capability snapshot");
    }
    return data as ArchitectEligibleFactor[];
  }
  const db = createAdminClient();
  const [factors, categories] = await Promise.all([
    db.from("factors").select("id,name,definition,description,indicators_low,indicators_mid,indicators_high,primary_category_id,dimension_id,dimensions(name)").eq("is_active", true).eq("is_public_visible", true).is("client_id", null).is("deleted_at", null).order("name"),
    db.from("library_categories").select("id,name,key").order("display_order"),
  ]);
  if (factors.error || categories.error) throw new Error("Capability model unavailable");
  const categoryById = new Map((categories.data ?? []).map(category => [category.id, category]));
  return (factors.data ?? []).map(factor => {
    const category = categoryById.get(factor.primary_category_id);
    const dimension = Array.isArray(factor.dimensions) ? factor.dimensions[0] : factor.dimensions;
    return { factorId: factor.id, factorName: factor.name, definition: factor.definition || factor.description, indicatorsLow: factor.indicators_low, indicatorsMid: factor.indicators_mid, indicatorsHigh: factor.indicators_high, categoryId: factor.primary_category_id, categoryName: category?.name ?? null, categoryKey: category?.key ?? null, dimensionId: factor.dimension_id, dimensionName: dimension?.name ?? null, availableItems: 0 };
  });
}
