import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getTechnicalReportData } from "@/lib/dal/instrument";
import { listCongruenceRatingsForBuild } from "@/lib/dal/instrument";
import { runCongruencePanel } from "@/lib/instrument/congruence";
import { forecastAlpha } from "@/lib/instrument/reliability";
import {
  buildTechnicalReport,
  type TechnicalReport,
} from "@/lib/instrument/technical-report";
import type { Blueprint } from "@/lib/instrument/types";

/**
 * Assemble the technical report for a build.
 *
 * This exists so the on-screen view and the print/PDF view cannot drift: both
 * render the SAME model. The first cut of this feature had each view querying
 * DTOs directly and formatting them itself, which left the report model — and
 * with it the evidence classes and the limitations section — rendered nowhere.
 * A report that omits its own limitations is the one version of this document
 * that would actually be dangerous to hand a customer.
 *
 * The report model is pure; everything I/O-shaped happens here.
 */
export async function assembleTechnicalReport(
  db: SupabaseClient,
  buildId: string,
  generatedAt: Date,
): Promise<{ report: TechnicalReport; instrumentName: string } | null> {
  const data = await getTechnicalReportData(db, buildId);
  if (!data) return null;

  const { build, blueprints, cellsByBlueprintId, itemsByBlueprintId } = data;

  const blueprintCells = blueprints.flatMap(
    (bp) => cellsByBlueprintId[bp.id] ?? [],
  );
  const allItems = blueprints.flatMap((bp) => itemsByBlueprintId[bp.id] ?? []);

  const candidateItems = allItems.map((item) => ({
    id: item.id,
    blueprintCellId: item.blueprintCellId ?? null,
    stem: item.stem,
    status: item.status,
  }));

  // The fairness screen persists its verdict under the item's payload. Dropping
  // payload here made every report claim zero items reviewed and zero flagged —
  // including a report opened straight after a screen that had just flagged
  // items. An empty fairness section reads as "we checked and it is clean",
  // which is a false statement when nothing was read at all.
  const fairnessResults = allItems.flatMap((item) => {
    const fairness = (item.payload as { fairness?: unknown } | null | undefined)
      ?.fairness as
      | { flags?: unknown; note?: unknown }
      | undefined;
    if (!fairness) return [];
    const flags = Array.isArray(fairness.flags)
      ? fairness.flags.filter((f): f is string => typeof f === "string")
      : [];
    return [
      {
        id: item.id,
        flags,
        note: typeof fairness.note === "string" ? fairness.note : undefined,
      },
    ];
  });

  // Rebuild the congruence panel from stored ratings. Absent ratings must yield
  // undefined, NOT an empty panel: an empty panel would report 0% assignment
  // accuracy, which reads as a catastrophic result rather than as "not run".
  const ratings = await listCongruenceRatingsForBuild(db, buildId);
  const congruenceResult =
    ratings.length > 0
      ? runCongruencePanel(
          ratings.map((r) => ({
            itemId: r.candidateItemId,
            raterIndex: r.raterIndex,
            raterModel: r.raterModel,
            assignedConstructId: r.assignedBlueprintId || "unknown",
            intendedConstructId: r.intendedBlueprintId,
            relevance: r.relevance as 1 | 2 | 3 | 4,
            ...(r.namedFacet && { namedFacet: r.namedFacet }),
          })),
        )
      : undefined;

  // Alpha forecast is per-instrument here, driven by the realised item count.
  // It is a FORECAST and the model tags it a_priori; the renderer must never
  // present it as an observation.
  const itemCount = candidateItems.length;
  const facetCount = new Set(blueprintCells.map((c) => c.facetLabel)).size;
  const alphaForecast =
    itemCount > 1
      ? forecastAlpha({ itemCount, facetCount: facetCount || 1 })
      : undefined;

  // The report model's Blueprint carries its own cells; the DTO keeps them in a
  // side map. Adapt rather than widen the model — the pure module should not
  // have to know how the DAL happens to shape its return.
  const modelBlueprints = blueprints.map((bp) => ({
    id: bp.id,
    constructId: bp.constructId ?? bp.draftConstructName ?? bp.id,
    measureType: bp.measureType as Blueprint["measureType"],
    cells: cellsByBlueprintId[bp.id] ?? [],
    createdAt: new Date(bp.createdAt),
    updatedAt: new Date(bp.updatedAt),
  })) satisfies Blueprint[];

  const nameById = new Map(
    blueprints.map((bp) => [
      bp.id,
      bp.draftConstructName ?? bp.constructId ?? "Unnamed construct",
    ]),
  );

  const report = buildTechnicalReport(
    {
      buildId,
      instrumentName: build.name,
      measureType: build.measureType,
      audience:
        typeof build.audience === "object" && build.audience !== null
          ? JSON.stringify(build.audience)
          : undefined,
      useContext: build.useContext ?? undefined,
      generatedAt,
      blueprints: modelBlueprints,
      constructNames: Object.fromEntries(
        blueprints.map((bp) => [
          bp.id,
          bp.draftConstructName ?? bp.constructId ?? "Unnamed construct",
        ]),
      ),
      blueprintCells,
      candidateItems,
      congruenceResult,
      fairnessResults,
      // Pairwise overlap persisted by the structure step. Reading it back is
      // what makes the report's discriminant section reflect a real check
      // rather than always reporting nothing.
      discriminantScores: data.evidenceRecords
        .filter((r) => r.claim === "construct_overlap")
        .flatMap((r) => {
          const peerId = r.detail?.source;
          const a = nameById.get(r.targetId);
          const b = peerId ? nameById.get(peerId) : undefined;
          if (!a || !b) return [];
          return [{ construct1: a, construct2: b, cosineSimilarity: r.value }];
        }),
      evidenceRecords: data.evidenceRecords,
    },
    alphaForecast,
  );

  return { report, instrumentName: build.name };
}
