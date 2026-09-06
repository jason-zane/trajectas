import { describe, it, expect } from "vitest";
import { outcomeInputHash } from "@/lib/outcomes/snapshot";
import {
  readRequestBytesWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/security/request-body";
describe("Outcome snapshot and upload integrity", () => {
  it("keeps the checksum across JSONB object reordering, while detecting changed data and row order", () => {
    const a = {
      config: { z: 1, a: 2 },
      rows: [
        { score: 4, kpi: 15 },
        { score: 5, kpi: 17 },
      ],
    };
    expect(outcomeInputHash(a)).toBe(
      outcomeInputHash({
        rows: [
          { kpi: 15, score: 4 },
          { kpi: 17, score: 5 },
        ],
        config: { a: 2, z: 1 },
      }),
    );
    expect(outcomeInputHash(a)).not.toBe(
      outcomeInputHash({ ...a, rows: [...a.rows].reverse() }),
    );
    expect(outcomeInputHash(a)).not.toBe(
      outcomeInputHash({ ...a, rows: [{ score: 4, kpi: 16 }, a.rows[1]] }),
    );
  });
  it("rejects chunked uploads that exceed the actual byte limit", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(7));
        controller.enqueue(new Uint8Array(7));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readRequestBytesWithLimit(request, 10)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
    expect(cancelled).toBe(true);
  });
  it("preserves arbitrary binary bytes needed for Excel uploads", async () => {
    const bytes = new Uint8Array([0, 255, 195, 169, 128, 10]);
    const request = new Request("http://localhost", {
      method: "POST",
      body: bytes,
    });
    expect(await readRequestBytesWithLimit(request, 6)).toEqual(bytes);
  });
});
