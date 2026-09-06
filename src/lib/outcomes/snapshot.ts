import { createHash } from "node:crypto";
// JSONB may reorder object keys. Hash a canonical serialization so a run can
// verify its input after a database round trip. Array order is meaningful.
export function canonicalOutcomeJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalOutcomeJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalOutcomeJson(record[key])}`,
      )
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (
    encoded === undefined ||
    (typeof value === "number" && !Number.isFinite(value))
  )
    throw new Error("Snapshot contains a non-JSON value.");
  return encoded;
}
export function outcomeInputHash(value: unknown): string {
  return createHash("sha256").update(canonicalOutcomeJson(value)).digest("hex");
}
