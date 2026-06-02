import { mapCampaignRow } from "@/lib/supabase/mappers";
import type {
  CampaignAssessmentOption,
  CampaignConsultantSettings,
  CampaignHeader,
  CampaignSessionRow,
  CampaignWithMeta,
} from "@/app/actions/campaigns";

/**
 * Pure row → DTO transforms for the campaigns DAL.
 *
 * I/O-free (no Supabase, no `server-only`) so the mapping logic is unit-tested
 * and coverage-gated. The query functions in `campaigns.ts` call these after
 * fetching rows. See src/lib/dal/README.md.
 */

/**
 * Map `campaigns_with_counts` view rows (which inline assessment/participant/
 * completed counts + an embedded `clients(name)`) to CampaignWithMeta DTOs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignWithCountsRows(rows: any[]): CampaignWithMeta[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((row: any) => ({
    ...mapCampaignRow(row),
    assessmentCount: row.assessment_count ?? 0,
    participantCount: row.participant_count ?? 0,
    completedCount: row.completed_count ?? 0,
    clientName: row.clients?.name ?? undefined,
  }));
}

/** Unwrap a possibly-array PostgREST embedded relation to a single row (or null). */
function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Map participant_sessions rows (joined to assessments + campaign_participants)
 * to CampaignSessionRow DTOs: assigns a 1-based attempt number per
 * (participant, assessment) in chronological order, then re-sorts newest first
 * for display. Input must already be ordered oldest-first by started_at.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignSessionRows(rows: any[]): CampaignSessionRow[] {
  const attemptCounter = new Map<string, number>();
  const mapped: CampaignSessionRow[] = (rows ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => {
      const assessment = unwrap(row.assessments);
      const cp = unwrap(row.campaign_participants);
      const name = `${cp?.first_name ?? ""} ${cp?.last_name ?? ""}`.trim();
      const key = `${row.campaign_participant_id}|${row.assessment_id}`;
      const attemptNumber = (attemptCounter.get(key) ?? 0) + 1;
      attemptCounter.set(key, attemptNumber);
      return {
        id: row.id,
        campaignParticipantId: row.campaign_participant_id,
        participantName: name || cp?.email || "Unknown",
        participantEmail: cp?.email ?? "",
        assessmentId: row.assessment_id,
        assessmentTitle: assessment?.title ?? "Untitled assessment",
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        attemptNumber,
      };
    },
  );

  mapped.sort((a, b) => {
    const ad = a.completedAt ?? a.startedAt ?? "";
    const bd = b.completedAt ?? b.startedAt ?? "";
    return bd.localeCompare(ad);
  });
  return mapped;
}

/**
 * Read a PostgREST aggregate (`relation(count)`) or an embedded array's length
 * into a number. Returns 0 for anything unrecognized.
 */
function getNestedCount(value: unknown): number {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object" && "count" in first) {
      const count = (first as { count?: number }).count;
      return Number.isFinite(count) ? Number(count) : 0;
    }
    return value.length;
  }
  if (value && typeof value === "object" && "count" in value) {
    const count = (value as { count?: number }).count;
    return Number.isFinite(count) ? Number(count) : 0;
  }
  return 0;
}

/** Human-readable response-format label for an assessment's section format types. */
function getFormatLabel(
  formatTypes: string[],
  formatMode?: string | null,
): string {
  const uniqueTypes = [...new Set(formatTypes.filter(Boolean))];
  if (formatMode === "forced_choice") return "Forced-choice";
  if (uniqueTypes.length === 0) return "Traditional";
  if (uniqueTypes.length > 1) return "Mixed";

  switch (uniqueTypes[0]) {
    case "likert":
      return "Likert";
    case "binary":
      return "Binary";
    case "sjt":
      return "SJT";
    case "forced_choice":
      return "Forced-choice";
    case "free_text":
      return "Free text";
    default:
      return uniqueTypes[0];
  }
}

/** Estimated seconds to answer one item of the given response-format type. */
function getSecondsPerItem(formatType: string): number {
  switch (formatType) {
    case "likert":
    case "binary":
      return 15;
    case "sjt":
    case "forced_choice":
      return 30;
    case "free_text":
      return 60;
    default:
      return 20;
  }
}

/**
 * Map `assessments` rows (with nested factor/section/item aggregates +
 * response_formats) to CampaignAssessmentOption DTOs, deriving section/item
 * counts, a format label, and an estimated duration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapActiveAssessmentRows(rows: any[]): CampaignAssessmentOption[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((row: any) => {
    const sections = Array.isArray(row.assessment_sections)
      ? row.assessment_sections
      : [];
    const totalItemCount = sections.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, section: any) =>
        sum + getNestedCount(section.assessment_section_items),
      0,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatTypes = sections.map((section: any) => {
      const responseFormat = Array.isArray(section.response_formats)
        ? section.response_formats[0]
        : section.response_formats;
      return String(responseFormat?.type ?? "");
    });
    const estimatedDurationSeconds = sections.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, section: any) => {
        const responseFormat = Array.isArray(section.response_formats)
          ? section.response_formats[0]
          : section.response_formats;
        const formatType = String(responseFormat?.type ?? "");
        return (
          sum +
          getNestedCount(section.assessment_section_items) *
            getSecondsPerItem(formatType)
        );
      },
      0,
    );

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status,
      factorCount: getNestedCount(row.assessment_factors),
      constructCount: 0,
      sectionCount: sections.length,
      totalItemCount,
      formatLabel: getFormatLabel(formatTypes, row.format_mode),
      estimatedDurationMinutes:
        estimatedDurationSeconds > 0
          ? Math.max(1, Math.ceil(estimatedDurationSeconds / 60))
          : 0,
      minCustomFactors: row.min_custom_factors ?? null,
    };
  });
}

/**
 * Map a campaign's consultant-notification columns to a CampaignConsultantSettings
 * DTO: coerces a possibly-null jsonb email array to strings and the flag columns
 * to booleans.
 */
export function mapConsultantSettings(row: {
  consultant_emails?: unknown;
  consultant_notification_enabled?: unknown;
  consultant_notification_include_summary?: unknown;
  consultant_notification_attach_pdf?: unknown;
}): CampaignConsultantSettings {
  return {
    emails: ((row.consultant_emails as string[] | null) ?? []).map((e) =>
      String(e),
    ),
    enabled: Boolean(row.consultant_notification_enabled),
    includeSummary: Boolean(row.consultant_notification_include_summary),
    attachPdf: Boolean(row.consultant_notification_attach_pdf),
  };
}

/**
 * Map a campaign row (with embedded `clients(name, can_customize_branding)`) +
 * a pre-counted assessment total to a CampaignHeader DTO.
 */
export function mapCampaignHeader(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  assessmentCount: number,
): CampaignHeader {
  const client = unwrap(row.clients) as {
    name?: string | null;
    can_customize_branding?: boolean | null;
  } | null;

  return {
    ...mapCampaignRow(row),
    clientName: client?.name ?? undefined,
    clientCanCustomizeBranding:
      client && "can_customize_branding" in client
        ? (client.can_customize_branding ?? null)
        : null,
    assessmentCount,
  };
}
