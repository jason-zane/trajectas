import type { ParticipantSessionProcessingStatus } from "@/types/database";
import type {
  ActivityEvent,
  ParticipantResponseGroup,
  ParticipantSession,
} from "@/app/actions/participants";

/**
 * Pure row → DTO transforms for the participants DAL.
 *
 * This module is intentionally I/O-free (no Supabase, no `server-only`) so the
 * mapping logic — where the real bugs live (null-coalescing, ordering, nested
 * shape) — can be unit-tested fast and gated by the coverage thresholds. The
 * query functions in `participants.ts` call these after fetching rows.
 */

/** Map raw participant_sessions rows (+ nested scores) to ParticipantSession DTOs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSessionRows(rows: any[]): ParticipantSession[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((s: any) => ({
    id: s.id,
    assessmentId: s.assessment_id,
    assessmentTitle: s.assessments?.title ?? "Untitled",
    status: s.status,
    processingStatus: (s.processing_status ??
      "idle") as ParticipantSessionProcessingStatus,
    processingError: s.processing_error ?? undefined,
    startedAt: s.started_at ?? undefined,
    completedAt: s.completed_at ?? undefined,
    processedAt: s.processed_at ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scores: (s.participant_scores ?? []).map((sc: any) => ({
      factorId: sc.factor_id,
      factorName: sc.factors?.name ?? sc.factor_id,
      rawScore: Number(sc.raw_score),
      scaledScore: Number(sc.scaled_score),
      percentile: sc.percentile != null ? Number(sc.percentile) : undefined,
      scoringMethod: sc.scoring_method,
      itemsUsed: 0,
    })),
  }));
}

/** Build a sorted activity timeline from a participant row + its session rows. */
export function buildActivityEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  participant: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionRows: any[],
): ActivityEvent[] {
  const p = participant;
  const events: ActivityEvent[] = [];

  if (p.invited_at) {
    events.push({
      type: "invited",
      timestamp: p.invited_at,
      label: "Invited to campaign",
      detail: p.campaigns?.title,
    });
  }
  if (p.started_at) {
    events.push({
      type: "started",
      timestamp: p.started_at,
      label: "Started assessment",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sessionRows ?? []) as any[]) {
    if (s.started_at) {
      events.push({
        type: "session_started",
        timestamp: s.started_at,
        label: `Started ${s.assessments?.title ?? "assessment"}`,
      });
    }
    if (s.completed_at) {
      events.push({
        type: "session_completed",
        timestamp: s.completed_at,
        label: `Completed ${s.assessments?.title ?? "assessment"}`,
      });
    }
  }

  if (p.completed_at) {
    events.push({
      type: "completed",
      timestamp: p.completed_at,
      label: "Completed all assessments",
    });
  }

  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return events;
}

/** Group item-level responses under their assessment sections, ordered. */
export function groupResponses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sections: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses: any[],
): ParticipantResponseGroup[] {
  const responseMap = new Map<string, { value: number; timeMs?: number }>();
  for (const r of responses ?? []) {
    responseMap.set(r.item_id, {
      value: Number(r.response_value),
      timeMs: r.response_time_ms ?? undefined,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sections ?? []).map((s: any) => ({
    sectionId: s.id,
    sectionTitle: s.title,
    displayOrder: s.display_order,
    items: (s.assessment_section_items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.display_order - b.display_order)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((si: any) => {
        const resp = responseMap.get(si.item_id ?? si.items?.id);
        return {
          itemId: si.items?.id ?? si.item_id,
          stem: si.items?.stem ?? "",
          responseValue: resp?.value,
          responseTimeMs: resp?.timeMs,
          displayOrder: si.display_order,
        };
      }),
  }));
}
