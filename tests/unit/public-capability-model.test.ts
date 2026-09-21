import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ fail: false, queries: [] as Array<{ table: string; select: string; filters: string[] }> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => {
  const query = { table, select: "", filters: [] as string[] }; state.queries.push(query);
  const chain = { select(value: string) { query.select = value; return chain; }, eq(key: string, value: unknown) { query.filters.push(`${key}:${value}`); return chain; }, is(key: string, value: unknown) { query.filters.push(`${key}:${value}`); return chain; }, order() { return Promise.resolve({ error: state.fail ? new Error("offline") : null, data: table === "library_categories" ? [{ id: "category", name: "Working", key: "working" }] : [{ id: "factor", name: "Example", definition: "Definition", indicators_high: "Indicator", primary_category_id: "category", dimension_id: "dimension", dimensions: { name: "Dimension" }, private_field: "never return" }] }); } };
  return chain;
} }) }));
import { getPublicCapabilityModel } from "@/lib/dal/public-capability-model";
it("reads only active, non-deleted reference content and returns the public projection", async () => {
  state.fail = false; state.queries = [];
  const result = await getPublicCapabilityModel();
  expect(state.queries[0].filters).toEqual(["is_active:true", "is_public_visible:true", "client_id:null", "deleted_at:null"]);
  expect(state.queries.map(query => query.table)).toEqual(["factors", "library_categories"]);
  expect(state.queries[0].select).not.toContain("*");
  expect(result[0]).toMatchObject({ factorName: "Example", categoryName: "Working", definition: "Definition", indicatorsHigh: "Indicator" });
  expect(result[0]).not.toHaveProperty("private_field");
});
it("does not present a partial model when a reference query fails", async () => {
  state.fail = true;
  await expect(getPublicCapabilityModel()).rejects.toThrow("Capability model unavailable");
});
it("ignores the local snapshot option in production", async () => {
  state.fail = false; state.queries = [];
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PUBLIC_CAPABILITY_MODEL_SNAPSHOT", "/nonexistent-preview-file.json");
  try {
    expect((await getPublicCapabilityModel())[0].factorName).toBe("Example");
    expect(state.queries).toHaveLength(2);
  } finally { vi.unstubAllEnvs(); }
});
