import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be hoisted so vi.mock factories can reference them
// ---------------------------------------------------------------------------

const supabaseMocks = vi.hoisted(() => {
  const maybeSingleFn = vi.fn();
  const orderFn = vi.fn();
  const upsertFn = vi.fn();

  // A reusable chainable query builder that all .select() calls share
  const selectChain = {
    eq: vi.fn(),
    is: vi.fn(),
    order: orderFn,
    maybeSingle: maybeSingleFn,
  };
  // Make chainable — each method returns the same object
  selectChain.eq.mockReturnValue(selectChain);
  selectChain.is.mockReturnValue(selectChain);

  const selectFn = vi.fn().mockReturnValue(selectChain);

  const fromFn = vi.fn().mockReturnValue({
    select: selectFn,
    upsert: upsertFn,
  });

  return { fromFn, selectFn, selectChain, maybeSingleFn, orderFn, upsertFn };
});

const actorMocks = vi.hoisted(() => ({
  resolveSessionActor: vi.fn(),
}));

const renderMocks = vi.hoisted(() => ({
  renderEmailHtml: vi.fn(),
}));

const sendMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

const providerMocks = vi.hoisted(() => ({
  sendHtmlEmail: vi.fn(),
}));

const brandMocks = vi.hoisted(() => ({
  getEffectiveBrand: vi.fn(),
}));

// ---------------------------------------------------------------------------
// vi.mock calls — all mocks must be registered before any imports
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: supabaseMocks.fromFn,
  }),
}));

vi.mock("@/lib/auth/actor", () => ({
  resolveSessionActor: actorMocks.resolveSessionActor,
}));

vi.mock("@/lib/email/render", () => ({
  renderEmailHtml: renderMocks.renderEmailHtml,
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: sendMocks.sendEmail,
}));

vi.mock("@/lib/email/provider", () => ({
  sendHtmlEmail: providerMocks.sendHtmlEmail,
}));

vi.mock("@/app/actions/brand", () => ({
  getEffectiveBrand: brandMocks.getEffectiveBrand,
}));

// Provide the real validation schema inline to avoid Zod/module-graph issues
// with z.enum(EMAIL_TYPES) being evaluated before the types module is fully loaded.
vi.mock("@/lib/validations/email-template", async () => {
  const { z } = await import("zod");
  const EMAIL_TYPES = [
    "magic_link",
    "staff_invite",
    "assessment_invite",
    "assessment_reminder",
    "report_ready",
    "welcome",
    "admin_notification",
  ] as const;
  const upsertEmailTemplateSchema = z.object({
    type: z.enum(EMAIL_TYPES),
    scopeType: z.enum(["platform", "partner", "client"] as const),
    scopeId: z.string().uuid().nullable(),
    subject: z.string().min(1, "Subject is required").max(500),
    previewText: z.string().max(500).nullable().optional(),
    editorJson: z.record(z.string(), z.unknown()),
  });
  return { upsertEmailTemplateSchema };
});

// ---------------------------------------------------------------------------
// SUT import (must come after vi.mock calls)
// ---------------------------------------------------------------------------

import {
  listEmailTemplates,
  getEmailTemplate,
  upsertEmailTemplate,
  sendTestEmail,
} from "@/app/actions/email-templates";
import { SAMPLE_VARIABLES } from "@/lib/email/types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ACTIVE_ACTOR = {
  id: "profile-123",
  email: "admin@trajectas.com",
  isActive: true,
  role: "platform_admin",
};

const PLATFORM_BRAND = {
  name: "Trajectas",
  primaryColor: "#2d6a5a",
  emailStyles: {
    textColor: "#1a1a1a",
    footerTextColor: "#737373",
    highlightColor: "#2d6a5a",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("email template actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply chain after clearAllMocks resets mock return values
    supabaseMocks.selectChain.eq.mockReturnValue(supabaseMocks.selectChain);
    supabaseMocks.selectChain.is.mockReturnValue(supabaseMocks.selectChain);
    supabaseMocks.selectFn.mockReturnValue(supabaseMocks.selectChain);
    supabaseMocks.fromFn.mockReturnValue({
      select: supabaseMocks.selectFn,
      upsert: supabaseMocks.upsertFn,
    });

    supabaseMocks.orderFn.mockResolvedValue({ data: [], error: null });
    supabaseMocks.maybeSingleFn.mockResolvedValue({ data: null, error: null });
    supabaseMocks.upsertFn.mockResolvedValue({ data: null, error: null });

    actorMocks.resolveSessionActor.mockResolvedValue(ACTIVE_ACTOR);
    brandMocks.getEffectiveBrand.mockResolvedValue(PLATFORM_BRAND);
    renderMocks.renderEmailHtml.mockResolvedValue({
      html: "<html>test</html>",
      text: "test",
    });
  });

  // -------------------------------------------------------------------------
  describe("listEmailTemplates", () => {
    it("queries with correct filters for platform scope (null scopeId)", async () => {
      const rows = [
        {
          id: "tmpl-1",
          type: "magic_link",
          scope_type: "platform",
          scope_id: null,
          subject: "Sign in to {{brandName}}",
          preview_text: null,
          is_active: true,
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];
      supabaseMocks.orderFn.mockResolvedValueOnce({ data: rows, error: null });

      const result = await listEmailTemplates("platform", null);

      expect(supabaseMocks.fromFn).toHaveBeenCalledWith("email_templates");
      expect(result).toEqual(rows);
    });

    it("queries with scope_id filter when scopeId is provided", async () => {
      supabaseMocks.orderFn.mockResolvedValueOnce({ data: [], error: null });

      await listEmailTemplates("client", "client-uuid-abc");

      expect(supabaseMocks.fromFn).toHaveBeenCalledWith("email_templates");
    });

    it("returns empty array when no templates exist", async () => {
      supabaseMocks.orderFn.mockResolvedValueOnce({ data: null, error: null });

      const result = await listEmailTemplates("partner", null);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe("getEmailTemplate", () => {
    it("returns null for deleted/missing templates (maybeSingle returning null)", async () => {
      supabaseMocks.maybeSingleFn.mockResolvedValueOnce({ data: null, error: null });

      const result = await getEmailTemplate("magic_link", "platform", null);

      expect(result).toBeNull();
    });

    it("returns template data when found", async () => {
      const template = {
        id: "tmpl-1",
        type: "magic_link",
        scope_type: "platform",
        scope_id: null,
        subject: "Sign in to {{brandName}}",
        preview_text: null,
        editor_json: { type: "doc" },
        html_cache: null,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        updated_by: null,
        deleted_at: null,
      };
      supabaseMocks.maybeSingleFn.mockResolvedValueOnce({ data: template, error: null });

      const result = await getEmailTemplate("magic_link", "platform", null);

      expect(result).toEqual(template);
    });

    it("throws when supabase returns an error", async () => {
      supabaseMocks.maybeSingleFn.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      await expect(getEmailTemplate("magic_link", "platform", null)).rejects.toThrow(
        "Database error",
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("upsertEmailTemplate", () => {
    const validInput = {
      type: "magic_link" as const,
      scopeType: "platform" as const,
      scopeId: null,
      subject: "Sign in to Trajectas",
      previewText: "Your sign-in link",
      editorJson: { type: "doc", content: [] },
    };

    it("validates input and calls upsert with correct params", async () => {
      const result = await upsertEmailTemplate(validInput);

      expect(result).toEqual({});
      expect(supabaseMocks.upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "magic_link",
          scope_type: "platform",
          scope_id: null,
          subject: "Sign in to Trajectas",
          preview_text: "Your sign-in link",
          editor_json: { type: "doc", content: [] },
          updated_by: "profile-123",
        }),
        { onConflict: "type,scope_type,scope_id" },
      );
    });

    it("returns field errors for invalid input", async () => {
      const result = await upsertEmailTemplate({
        type: "magic_link",
        scopeType: "platform",
        scopeId: null,
        subject: "", // fails min(1)
        editorJson: { type: "doc" },
      });

      expect(result).toMatchObject({
        error: expect.objectContaining({ subject: expect.any(Array) }),
      });
      expect(supabaseMocks.upsertFn).not.toHaveBeenCalled();
    });

    it("returns auth error when actor is inactive", async () => {
      actorMocks.resolveSessionActor.mockResolvedValueOnce({
        ...ACTIVE_ACTOR,
        isActive: false,
      });

      const result = await upsertEmailTemplate(validInput);

      expect(result).toMatchObject({ error: { _form: ["Unauthorized"] } });
      expect(supabaseMocks.upsertFn).not.toHaveBeenCalled();
    });

    it("returns auth error when no actor session", async () => {
      actorMocks.resolveSessionActor.mockResolvedValueOnce(null);

      const result = await upsertEmailTemplate(validInput);

      expect(result).toMatchObject({ error: { _form: ["Unauthorized"] } });
    });

    it("pre-renders html_cache and includes it in upsert", async () => {
      renderMocks.renderEmailHtml.mockResolvedValueOnce({
        html: "<html>rendered</html>",
        text: "rendered",
      });

      await upsertEmailTemplate(validInput);

      expect(renderMocks.renderEmailHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          editorJson: validInput.editorJson,
          variables: SAMPLE_VARIABLES.magic_link,
        }),
      );
      expect(supabaseMocks.upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({ html_cache: "<html>rendered</html>" }),
        expect.any(Object),
      );
    });

    it("proceeds with null html_cache if pre-render fails (non-fatal)", async () => {
      renderMocks.renderEmailHtml.mockRejectedValueOnce(new Error("render failed"));

      const result = await upsertEmailTemplate(validInput);

      expect(result).toEqual({});
      expect(supabaseMocks.upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({ html_cache: null }),
        expect.any(Object),
      );
    });

    it("returns error when upsert fails", async () => {
      supabaseMocks.upsertFn.mockResolvedValueOnce({
        data: null,
        error: { message: "Unique constraint violation" },
      });

      const result = await upsertEmailTemplate(validInput);

      expect(result).toMatchObject({ error: { _form: ["Unique constraint violation"] } });
    });
  });

  // -------------------------------------------------------------------------
  describe("sendTestEmail", () => {
    it("calls sendEmail with SAMPLE_VARIABLES and actor email", async () => {
      await sendTestEmail("magic_link");

      expect(sendMocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "magic_link",
          to: "admin@trajectas.com",
          variables: SAMPLE_VARIABLES.magic_link,
        }),
      );
    });

    it("passes scopeClientId when scopeType is client", async () => {
      await sendTestEmail("assessment_invite", "client", "client-uuid-456");

      expect(sendMocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "assessment_invite",
          to: "admin@trajectas.com",
          scopeClientId: "client-uuid-456",
        }),
      );
    });

    it("passes scopePartnerId when scopeType is partner", async () => {
      await sendTestEmail("staff_invite", "partner", "partner-uuid-789");

      expect(sendMocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "staff_invite",
          scopePartnerId: "partner-uuid-789",
        }),
      );
    });

    it("throws when actor is not active", async () => {
      actorMocks.resolveSessionActor.mockResolvedValueOnce({
        ...ACTIVE_ACTOR,
        isActive: false,
      });

      await expect(sendTestEmail("magic_link")).rejects.toThrow("Unauthorized");
    });

    it("throws when no actor session", async () => {
      actorMocks.resolveSessionActor.mockResolvedValueOnce(null);

      await expect(sendTestEmail("magic_link")).rejects.toThrow("Unauthorized");
    });
  });
});
