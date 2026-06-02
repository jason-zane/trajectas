import { describe, expect, it } from "vitest";
import {
  assembleCampaignDetail,
  mapActiveAssessmentRows,
  mapCampaignHeader,
  mapCampaignSessionRows,
  mapCampaignWithCountsRows,
  mapConsultantSettings,
} from "@/lib/dal/campaigns-mappers";
import type { CampaignHeader } from "@/app/actions/campaigns";

const baseRow = {
  id: "c1",
  title: "Q1 Launch",
  slug: "q1-launch",
  status: "active",
  client_id: "client-1",
  allow_resume: true,
  show_progress: true,
  randomize_assessment_order: false,
  created_at: "2026-01-01T00:00:00Z",
};

describe("mapCampaignWithCountsRows", () => {
  it("threads the inlined counts and embedded client name through", () => {
    const [c] = mapCampaignWithCountsRows([
      {
        ...baseRow,
        assessment_count: 3,
        participant_count: 12,
        completed_count: 5,
        clients: { name: "Acme Corp" },
      },
    ]);

    expect(c).toMatchObject({
      id: "c1",
      title: "Q1 Launch",
      slug: "q1-launch",
      assessmentCount: 3,
      participantCount: 12,
      completedCount: 5,
      clientName: "Acme Corp",
    });
  });

  it("defaults missing counts to 0 and client name to undefined", () => {
    const [c] = mapCampaignWithCountsRows([{ ...baseRow }]);
    expect(c.assessmentCount).toBe(0);
    expect(c.participantCount).toBe(0);
    expect(c.completedCount).toBe(0);
    expect(c.clientName).toBeUndefined();
  });

  it("returns [] for nullish input", () => {
    // @ts-expect-error exercising the nullish guard
    expect(mapCampaignWithCountsRows(null)).toEqual([]);
    expect(mapCampaignWithCountsRows([])).toEqual([]);
  });
});

describe("mapCampaignSessionRows", () => {
  // Input is oldest-first by started_at (as the query returns it).
  const rows = [
    {
      id: "s1",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T01:00:00Z",
      assessment_id: "a1",
      campaign_participant_id: "cp1",
      assessments: { id: "a1", title: "Numerical" },
      campaign_participants: {
        id: "cp1",
        email: "alice@example.com",
        first_name: "Alice",
        last_name: "Smith",
      },
    },
    {
      id: "s2",
      status: "in_progress",
      started_at: "2026-01-02T00:00:00Z",
      completed_at: null,
      assessment_id: "a1",
      campaign_participant_id: "cp1",
      // embedded relations returned as single-element arrays (PostgREST form)
      assessments: [{ id: "a1", title: "Numerical" }],
      campaign_participants: [
        {
          id: "cp1",
          email: "alice@example.com",
          first_name: "Alice",
          last_name: "Smith",
        },
      ],
    },
  ];

  it("numbers attempts chronologically per (participant, assessment)", () => {
    const out = mapCampaignSessionRows(rows);
    const byId = Object.fromEntries(out.map((r) => [r.id, r]));
    expect(byId.s1.attemptNumber).toBe(1);
    expect(byId.s2.attemptNumber).toBe(2);
    expect(byId.s1.participantName).toBe("Alice Smith");
    expect(byId.s1.assessmentTitle).toBe("Numerical");
  });

  it("sorts newest first by completed-or-started date", () => {
    const out = mapCampaignSessionRows(rows);
    // s2 started later (2026-01-02) than s1 completed (2026-01-01) → s2 first
    expect(out.map((r) => r.id)).toEqual(["s2", "s1"]);
  });

  it("falls back name → email → Unknown, and unset titles", () => {
    const out = mapCampaignSessionRows([
      {
        id: "x",
        status: "completed",
        started_at: null,
        completed_at: null,
        assessment_id: "a9",
        campaign_participant_id: "cp9",
        assessments: null,
        campaign_participants: {
          id: "cp9",
          email: "bob@example.com",
          first_name: null,
          last_name: null,
        },
      },
    ]);
    expect(out[0].participantName).toBe("bob@example.com");
    expect(out[0].assessmentTitle).toBe("Untitled assessment");
  });

  it("returns [] for nullish input", () => {
    // @ts-expect-error exercising the nullish guard
    expect(mapCampaignSessionRows(null)).toEqual([]);
  });
});

describe("mapActiveAssessmentRows", () => {
  it("derives counts, format label, and estimated duration", () => {
    const [a] = mapActiveAssessmentRows([
      {
        id: "a1",
        title: "Cognitive Battery",
        description: "desc",
        status: "active",
        format_mode: null,
        min_custom_factors: 2,
        assessment_factors: [{ count: 4 }],
        assessment_sections: [
          {
            id: "sec1",
            response_formats: { type: "likert" }, // 15s/item
            assessment_section_items: [{ count: 10 }],
          },
          {
            id: "sec2",
            response_formats: [{ type: "sjt" }], // 30s/item, array form
            assessment_section_items: [{ count: 2 }],
          },
        ],
      },
    ]);

    expect(a).toMatchObject({
      id: "a1",
      title: "Cognitive Battery",
      factorCount: 4,
      constructCount: 0,
      sectionCount: 2,
      totalItemCount: 12,
      formatLabel: "Mixed", // likert + sjt
      minCustomFactors: 2,
    });
    // 10*15 + 2*30 = 210s → ceil(210/60) = 4 min
    expect(a.estimatedDurationMinutes).toBe(4);
  });

  it("labels a single format and rounds tiny durations up to 1 minute", () => {
    const [a] = mapActiveAssessmentRows([
      {
        id: "a2",
        title: "Quick",
        status: "draft",
        assessment_sections: [
          {
            id: "s",
            response_formats: { type: "binary" }, // 15s
            assessment_section_items: [{ count: 1 }],
          },
        ],
      },
    ]);
    expect(a.formatLabel).toBe("Binary");
    expect(a.estimatedDurationMinutes).toBe(1); // 15s → ceil → 1
  });

  it("forced_choice format mode overrides the label", () => {
    const [a] = mapActiveAssessmentRows([
      { id: "a3", title: "FC", status: "active", format_mode: "forced_choice" },
    ]);
    expect(a.formatLabel).toBe("Forced-choice");
    expect(a.sectionCount).toBe(0);
    expect(a.totalItemCount).toBe(0);
    expect(a.estimatedDurationMinutes).toBe(0);
  });

  it("defaults to Traditional when there are no sections", () => {
    const [a] = mapActiveAssessmentRows([
      { id: "a4", title: "Empty", status: "active" },
    ]);
    expect(a.formatLabel).toBe("Traditional");
    expect(a.factorCount).toBe(0);
  });

  it("returns [] for nullish input", () => {
    // @ts-expect-error exercising the nullish guard
    expect(mapActiveAssessmentRows(null)).toEqual([]);
  });
});

describe("mapConsultantSettings", () => {
  it("coerces emails to strings and flags to booleans", () => {
    expect(
      mapConsultantSettings({
        consultant_emails: ["a@x.com", "b@y.com"],
        consultant_notification_enabled: true,
        consultant_notification_include_summary: false,
        consultant_notification_attach_pdf: true,
      }),
    ).toEqual({
      emails: ["a@x.com", "b@y.com"],
      enabled: true,
      includeSummary: false,
      attachPdf: true,
    });
  });

  it("defaults null emails to [] and null/absent flags to false", () => {
    expect(
      mapConsultantSettings({
        consultant_emails: null,
        consultant_notification_enabled: null,
      }),
    ).toEqual({
      emails: [],
      enabled: false,
      includeSummary: false,
      attachPdf: false,
    });
  });

  it("coerces truthy/falsy flag values via Boolean()", () => {
    const out = mapConsultantSettings({
      consultant_emails: [],
      consultant_notification_enabled: 1,
      consultant_notification_include_summary: 0,
      consultant_notification_attach_pdf: "yes",
    });
    expect(out.enabled).toBe(true);
    expect(out.includeSummary).toBe(false);
    expect(out.attachPdf).toBe(true);
  });
});

describe("mapCampaignHeader", () => {
  const baseRow = {
    id: "c1",
    title: "Q1",
    slug: "q1",
    status: "active",
    allow_resume: true,
    show_progress: true,
    randomize_assessment_order: false,
    created_at: "2026-01-01T00:00:00Z",
  };

  it("threads client name + branding flag + assessment count", () => {
    const h = mapCampaignHeader(
      { ...baseRow, clients: { name: "Acme", can_customize_branding: true } },
      3,
    );
    expect(h).toMatchObject({
      id: "c1",
      clientName: "Acme",
      clientCanCustomizeBranding: true,
      assessmentCount: 3,
    });
  });

  it("unwraps an array-form client relation", () => {
    const h = mapCampaignHeader(
      { ...baseRow, clients: [{ name: "Acme", can_customize_branding: false }] },
      0,
    );
    expect(h.clientName).toBe("Acme");
    expect(h.clientCanCustomizeBranding).toBe(false);
  });

  it("yields null branding + undefined name for a platform-owned campaign (no client)", () => {
    const h = mapCampaignHeader({ ...baseRow, clients: null }, 1);
    expect(h.clientName).toBeUndefined();
    expect(h.clientCanCustomizeBranding).toBeNull();
    expect(h.assessmentCount).toBe(1);
  });

  it("maps a null branding flag to null (not false)", () => {
    const h = mapCampaignHeader(
      { ...baseRow, clients: { name: "Acme", can_customize_branding: null } },
      0,
    );
    expect(h.clientCanCustomizeBranding).toBeNull();
  });
});

describe("assembleCampaignDetail", () => {
  const header: CampaignHeader = {
    id: "c1",
    title: "Q1",
    slug: "q1",
    status: "active",
    kind: "self",
    clientId: "client-1",
    branding: {},
    allowResume: true,
    showProgress: true,
    randomizeAssessmentOrder: false,
    created_at: "2026-01-01T00:00:00Z",
    // header-only extras that must be stripped
    clientName: "Acme",
    clientCanCustomizeBranding: true,
    assessmentCount: 9,
  };

  it("strips header extras and maps nested collections", () => {
    const detail = assembleCampaignDetail(header, {
      assessmentRows: [
        {
          id: "ca1",
          campaign_id: "c1",
          assessment_id: "a1",
          display_order: 0,
          is_required: true,
          created_at: "2026-01-01T00:00:00Z",
          assessments: { title: "Numerical", status: "active", min_custom_factors: 3 },
        },
      ],
      participantRows: [
        {
          id: "p1",
          campaign_id: "c1",
          email: "a@b.com",
          participant_sessions: [
            { id: "s1", status: "completed" },
            { id: "s2", status: "in_progress" },
          ],
        },
      ],
      linkRows: [
        { id: "l1", campaign_id: "c1", token: "tok", created_at: "2026-01-01T00:00:00Z" },
      ],
    });

    // header-only fields are gone; clientName is kept
    expect(detail).not.toHaveProperty("clientCanCustomizeBranding");
    expect(detail).not.toHaveProperty("assessmentCount");
    expect(detail.clientName).toBe("Acme");
    expect(detail.id).toBe("c1");

    expect(detail.assessments).toHaveLength(1);
    expect(detail.assessments[0]).toMatchObject({
      assessmentTitle: "Numerical",
      assessmentStatus: "active",
      minCustomFactors: 3,
    });

    expect(detail.participants).toHaveLength(1);
    // participantSessions is attached at runtime (not in the declared type)
    expect(
      (detail.participants[0] as unknown as { participantSessions: unknown[] })
        .participantSessions,
    ).toEqual([
      { id: "s1", status: "completed" },
      { id: "s2", status: "in_progress" },
    ]);

    expect(detail.accessLinks).toHaveLength(1);
  });

  it("applies fallbacks and tolerates null/empty row sets", () => {
    const detail = assembleCampaignDetail(header, {
      assessmentRows: [
        {
          id: "ca2",
          campaign_id: "c1",
          assessment_id: "a2",
          display_order: 0,
          is_required: false,
          created_at: "2026-01-01T00:00:00Z",
          assessments: null, // missing embedded metadata
        },
      ],
      participantRows: null,
      linkRows: null,
    });
    expect(detail.assessments[0]).toMatchObject({
      assessmentTitle: "Untitled",
      assessmentStatus: "draft",
      minCustomFactors: null,
    });
    expect(detail.participants).toEqual([]);
    expect(detail.accessLinks).toEqual([]);
  });
});
