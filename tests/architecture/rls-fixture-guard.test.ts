/**
 * Pins the integration-test prod-safety guard so it can't silently regress.
 *
 * The shared RLS fixture must (a) recognise only local Supabase hosts, and
 * (b) throw — fail closed — when asked to connect to anything else. This is
 * the runtime backstop for the prod-write footgun (`.env.local` points at
 * production) that complements the static check in
 * tests/architecture/integration-host-guard.test.ts.
 */

import { describe, expect, it } from "vitest";
import {
  isLocalSupabaseUrl,
  assertLocalSupabaseUrl,
} from "../integration/_helpers/rls-fixture";

const LOCAL_URLS = [
  "http://127.0.0.1:54321",
  "http://localhost:54321",
  "https://localhost",
  "http://host.docker.internal:54321",
  "http://kong:8000",
  "127.0.0.1:54321",
];

const NON_LOCAL_URLS = [
  "https://rwpfwfcaxoevnvtkdmkx.supabase.co", // the real prod project
  "https://example.supabase.co",
  "https://db.rwpfwfcaxoevnvtkdmkx.supabase.co",
  "https://127.0.0.1.evil.com", // lookalike must NOT pass
  "https://notlocalhost.com",
];

describe("rls-fixture local-host guard", () => {
  it("recognises local Supabase hosts", () => {
    for (const url of LOCAL_URLS) {
      expect(isLocalSupabaseUrl(url), url).toBe(true);
    }
  });

  it("rejects non-local hosts, including lookalikes", () => {
    for (const url of NON_LOCAL_URLS) {
      expect(isLocalSupabaseUrl(url), url).toBe(false);
    }
  });

  it("treats missing/empty URLs as non-local (CI skips, never connects)", () => {
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
    expect(isLocalSupabaseUrl(null)).toBe(false);
    expect(isLocalSupabaseUrl("")).toBe(false);
  });

  it("assert throws (fail closed) for non-local hosts", () => {
    for (const url of NON_LOCAL_URLS) {
      expect(() => assertLocalSupabaseUrl(url), url).toThrow(/non-local host/);
    }
  });

  it("assert is a no-op for local hosts and for an unset URL", () => {
    for (const url of LOCAL_URLS) {
      expect(() => assertLocalSupabaseUrl(url), url).not.toThrow();
    }
    expect(() => assertLocalSupabaseUrl(undefined)).not.toThrow();
  });
});
