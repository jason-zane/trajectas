import { describe, expect, it } from "vitest";
import {
  parseJsonRequestWithLimit,
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/security/request-body";

describe("request body limits", () => {
  it("reads text within the byte limit", async () => {
    const request = new Request("https://trajectas.test/api", {
      method: "POST",
      body: "hello",
    });

    await expect(readRequestTextWithLimit(request, 5)).resolves.toBe("hello");
  });

  it("rejects bodies over the content-length limit", async () => {
    const request = new Request("https://trajectas.test/api", {
      method: "POST",
      headers: { "content-length": "6" },
      body: "hello!",
    });

    await expect(readRequestTextWithLimit(request, 5)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });

  it("rejects streamed bodies that exceed the limit", async () => {
    const request = new Request("https://trajectas.test/api", {
      method: "POST",
      body: "hello!",
    });

    await expect(readRequestTextWithLimit(request, 5)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });

  it("parses JSON within the byte limit", async () => {
    const request = new Request("https://trajectas.test/api", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });

    await expect(parseJsonRequestWithLimit(request, 20)).resolves.toEqual({
      ok: true,
    });
  });
});
