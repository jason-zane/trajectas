import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

// Chain-able Supabase query builder mock
const queryBuilder = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = ["select", "eq", "is", "maybeSingle"];
  for (const m of chainMethods) {
    builder[m] = vi.fn();
  }
  // Default: each chain method returns the builder itself (except maybeSingle)
  for (const m of chainMethods) {
    builder[m].mockReturnValue(builder);
  }
  return builder;
});

const mockAdmin = vi.hoisted(() => ({
  from: vi.fn(() => queryBuilder),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdmin,
}));

// ---------------------------------------------------------------------------
// Import module under test (AFTER mocks)
// ---------------------------------------------------------------------------

import { findTemplate, resolveTemplate } from "@/lib/email/template-registry";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const platformTemplate = {
  id: "tmpl-platform-1",
  type: "magic_link" as const,
  scope_type: "platform" as const,
  scope_id: null,
  subject: "Sign in to {{brandName}}",
  preview_text: null,
  editor_json: {},
  html_cache: "<p>Sign in</p>",
  is_active: true,
};

const partnerTemplate = {
  ...platformTemplate,
  id: "tmpl-partner-1",
  scope_type: "partner" as const,
  scope_id: "partner-abc",
  subject: "Partner: Sign in to {{brandName}}",
};

const clientTemplate = {
  ...platformTemplate,
  id: "tmpl-client-1",
  scope_type: "client" as const,
  scope_id: "client-xyz",
  subject: "Client: Sign in to {{brandName}}",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("template-registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset builder: all chain methods return builder by default
    for (const m of Object.keys(queryBuilder)) {
      queryBuilder[m].mockReturnValue(queryBuilder);
    }
    mockAdmin.from.mockReturnValue(queryBuilder);
  });

  // -------------------------------------------------------------------------
  // findTemplate
  // -------------------------------------------------------------------------
  describe("findTemplate", () => {
    it("queries with is(scope_id, null) when scopeId is null", async () => {
      queryBuilder.maybeSingle.mockResolvedValueOnce({
        data: platformTemplate,
        error: null,
      });

      const result = await findTemplate("magic_link", "platform", null);

      expect(mockAdmin.from).toHaveBeenCalledWith("email_templates");
      expect(queryBuilder.is).toHaveBeenCalledWith("scope_id", null);
      expect(result).toEqual(platformTemplate);
    });

    it("queries with eq(scope_id, id) when scopeId is provided", async () => {
      queryBuilder.maybeSingle.mockResolvedValueOnce({
        data: clientTemplate,
        error: null,
      });

      const result = await findTemplate("magic_link", "client", "client-xyz");

      expect(queryBuilder.eq).toHaveBeenCalledWith("scope_id", "client-xyz");
      expect(result).toEqual(clientTemplate);
    });

    it("returns null when no matching template exists", async () => {
      queryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await findTemplate("magic_link", "client", "no-such-client");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // resolveTemplate
  // -------------------------------------------------------------------------
  describe("resolveTemplate", () => {
    it("returns platform default when no scope ids provided", async () => {
      queryBuilder.maybeSingle.mockResolvedValueOnce({
        data: platformTemplate,
        error: null,
      });

      const result = await resolveTemplate("magic_link", {});

      expect(result).toEqual(platformTemplate);
      // Only one DB lookup — the platform lookup
      expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(1);
    });

    it("returns client template when client scope matches", async () => {
      queryBuilder.maybeSingle.mockResolvedValueOnce({
        data: clientTemplate,
        error: null,
      });

      const result = await resolveTemplate("magic_link", {
        clientId: "client-xyz",
        partnerId: "partner-abc",
      });

      expect(result).toEqual(clientTemplate);
      // Found at client level — stops there
      expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(1);
    });

    it("falls back through cascade: client miss → partner miss → platform hit", async () => {
      queryBuilder.maybeSingle
        // client lookup: miss
        .mockResolvedValueOnce({ data: null, error: null })
        // partner lookup: miss
        .mockResolvedValueOnce({ data: null, error: null })
        // platform lookup: hit
        .mockResolvedValueOnce({ data: platformTemplate, error: null });

      const result = await resolveTemplate("magic_link", {
        clientId: "client-xyz",
        partnerId: "partner-abc",
      });

      expect(result).toEqual(platformTemplate);
      expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(3);
    });

    it("falls back through cascade: client miss → partner hit (skips platform)", async () => {
      queryBuilder.maybeSingle
        // client lookup: miss
        .mockResolvedValueOnce({ data: null, error: null })
        // partner lookup: hit
        .mockResolvedValueOnce({ data: partnerTemplate, error: null });

      const result = await resolveTemplate("magic_link", {
        clientId: "client-xyz",
        partnerId: "partner-abc",
      });

      expect(result).toEqual(partnerTemplate);
      expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(2);
    });

    it("returns null when no template found at any level", async () => {
      queryBuilder.maybeSingle
        // client lookup: miss
        .mockResolvedValueOnce({ data: null, error: null })
        // partner lookup: miss
        .mockResolvedValueOnce({ data: null, error: null })
        // platform lookup: miss
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await resolveTemplate("magic_link", {
        clientId: "client-xyz",
        partnerId: "partner-abc",
      });

      expect(result).toBeNull();
    });

    it("skips partner lookup when no partnerId is provided", async () => {
      queryBuilder.maybeSingle
        // client lookup: miss
        .mockResolvedValueOnce({ data: null, error: null })
        // platform lookup: hit
        .mockResolvedValueOnce({ data: platformTemplate, error: null });

      const result = await resolveTemplate("magic_link", {
        clientId: "client-xyz",
      });

      expect(result).toEqual(platformTemplate);
      // client + platform — no partner step
      expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(2);
    });
  });
});
