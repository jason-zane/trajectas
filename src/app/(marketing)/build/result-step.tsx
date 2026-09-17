"use client";

import { useMemo, useState } from "react";
import type { Brief } from "@/types/ai";
import type { ArchitectMatchResult, ArchitectPick } from "@/types/architect";
import {
  PUBLIC_BUILDS_TIER_ORDER,
  PUBLIC_BUILDS_TIERS,
  PUBLIC_BUILDS_ITEMS_PER_FACTOR,
  type PublicBuildTier,
  estimatePublicBuildMinutes,
} from "@/lib/public-builds/shared";
import { WallPage } from "./wall-page";

function nearestTier(optimal: number): PublicBuildTier {
  let best: PublicBuildTier = "core";
  let bestDiff = Infinity;
  for (const t of PUBLIC_BUILDS_TIER_ORDER) {
    const diff = Math.abs(PUBLIC_BUILDS_TIERS[t].capabilities - optimal);
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best;
}

export function ResultStep({
  email,
  brief,
  ranking,
  summary,
  selectedIds,
  onToggle,
  onSetCount,
  onCreate,
  creating,
  createError,
}: {
  email: string;
  brief: Brief;
  ranking: ArchitectMatchResult;
  summary: string | null;
  selectedIds: string[];
  onToggle: (factorId: string) => void;
  onSetCount: (count: number) => void;
  onCreate: () => void;
  creating: boolean;
  createError: string | null;
}) {
  const [openFactorId, setOpenFactorId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(ranking.picks.map((p) => [p.factorId, p])), [ranking.picks]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((p): p is ArchitectPick => Boolean(p))
        .sort((a, b) => a.rank - b.rank),
    [selectedIds, byId],
  );
  const alternatives = useMemo(
    () => ranking.picks.filter((p) => !selectedSet.has(p.factorId)).slice(0, 4),
    [ranking.picks, selectedSet],
  );
  const recommendedTier = nearestTier(ranking.recommendedCount.optimal);
  const totalItems = selected.length * PUBLIC_BUILDS_ITEMS_PER_FACTOR;
  const minutes = estimatePublicBuildMinutes(selected.length);
  const openFactor = openFactorId ? byId.get(openFactorId) : null;

  function pinAlternative(factorId: string) {
    if (selected.length >= 8) return;
    onToggle(factorId);
  }
  function unpin(factorId: string) {
    if (selected.length <= 4) return;
    onToggle(factorId);
    if (openFactorId === factorId) setOpenFactorId(null);
  }

  return (
    <WallPage email={email} width="wide">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.5vw, 2.75rem)" }}>
            {selected.length} capabilit{selected.length === 1 ? "y" : "ies"} this role turns on.
          </h1>
          <span className="tag relative">
            <i className="pin" aria-hidden="true" />
            {selected.length} capabilities &middot; {totalItems} items &middot; about {minutes} min
          </span>
        </div>
        {summary && <p className="lede mb-8 max-w-[70ch]">{summary}</p>}

        <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
          {/* LEFT: the role, read */}
          <section aria-labelledby="r-role" className="flex flex-col gap-7">
            <div className="card relative flex flex-col gap-3 p-6">
              <i className="pin" aria-hidden="true" />
              <p id="r-role" className="label label-ink">
                The role
              </p>
              <p className="title" style={{ fontSize: 19 }}>
                {brief.roleTitle}
              </p>
              <p className="body-soft" style={{ fontSize: 13.5 }}>
                Read as {brief.roleTitle} &middot; {brief.function || "General"} &middot; {brief.level}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <p className="label label-paper">How much of the role to measure</p>
              {PUBLIC_BUILDS_TIER_ORDER.map((t) => {
                const meta = PUBLIC_BUILDS_TIERS[t];
                const isCurrent = selected.length === meta.capabilities;
                const isRecommended = t === recommendedTier;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onSetCount(meta.capabilities)}
                    className={`card relative flex items-center justify-between px-4 py-3.5 text-left ${isCurrent ? "lift" : ""}`}
                    style={{
                      boxShadow: isCurrent ? undefined : "none",
                      border: isCurrent ? "1px solid var(--gold)" : "1px solid rgba(251,250,246,0.35)",
                      background: isCurrent ? undefined : "rgba(251,250,246,0.94)",
                    }}
                  >
                    <span className={isCurrent ? "title" : "body"} style={{ fontSize: 15 }}>
                      {meta.label}
                    </span>
                    <span className="measure">
                      {meta.capabilities} &middot; ~{estimatePublicBuildMinutes(meta.capabilities)} min
                    </span>
                    {isRecommended && (
                      <span className="stamp" style={{ right: -14, top: -18 }}>
                        Recommended for this role
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* RIGHT: pinned cards + alternatives */}
          <section aria-labelledby="r-pins">
            <p id="r-pins" className="label label-paper mb-4">
              Pinned for this role
            </p>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              {selected.map((pick) => (
                <button
                  key={pick.factorId}
                  type="button"
                  className="cap-card text-left"
                  style={{ minHeight: 150 }}
                  onClick={() => setOpenFactorId(pick.factorId)}
                >
                  <i className="pin" aria-hidden="true" />
                  <span
                    className="unpin"
                    role="button"
                    aria-label={`Unpin ${pick.factorName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      unpin(pick.factorId);
                    }}
                  >
                    &times;
                  </span>
                  <p className="title" style={{ fontSize: 16, paddingRight: 36 }}>
                    {pick.factorName}
                  </p>
                  <p className="body-soft" style={{ fontSize: 13 }}>
                    {pick.definition?.slice(0, 80) || "—"}
                  </p>
                </button>
              ))}
            </div>

            {alternatives.length > 0 && (
              <div className="mt-9">
                <div className="mb-3.5 flex items-baseline justify-between">
                  <p className="label label-paper">Close alternatives</p>
                  <p className="body" style={{ color: "var(--mint)", fontSize: 13.5, margin: 0 }}>
                    Pin one and the length updates. Take one out with &times;.
                  </p>
                </div>
                <div
                  className="grid grid-cols-2 gap-4 rounded-sm p-4 sm:grid-cols-4"
                  style={{ background: "var(--baize-deep)", borderTop: "1px solid rgba(201,169,98,0.6)" }}
                >
                  {alternatives.map((alt) => (
                    <div key={alt.factorId} className="cap flex-col items-stretch gap-2.5 p-3.5">
                      <button
                        type="button"
                        className="title text-left"
                        style={{ fontSize: 14.5, fontWeight: 700, background: "none", border: 0, padding: 0, cursor: "pointer" }}
                        onClick={() => setOpenFactorId(alt.factorId)}
                      >
                        {alt.factorName}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ink-outline"
                        style={{ minHeight: 34, fontSize: 11, padding: "0 10px" }}
                        disabled={selected.length >= 8}
                        onClick={() => pinAlternative(alt.factorId)}
                      >
                        Pin &middot; +{estimatePublicBuildMinutes(1)} min
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {openFactor && (
          <aside
            role="dialog"
            aria-labelledby="d-title"
            className="card lift fixed inset-x-6 bottom-6 z-20 flex flex-col gap-3 p-6 sm:inset-x-auto sm:right-12 sm:bottom-12 sm:w-[420px]"
          >
            <i className="pin pin-left" aria-hidden="true" />
            <p id="d-title" className="title" style={{ fontSize: 20 }}>
              {openFactor.factorName}
            </p>
            <p className="body" style={{ fontSize: 14.5 }}>
              {openFactor.definition || "No definition available."}
            </p>
            {openFactor.indicatorsHigh && (
              <>
                <div className="rule" />
                <p className="label label-ink">Looks like, at a high level</p>
                <p className="body-soft" style={{ fontSize: 13.5 }}>
                  {openFactor.indicatorsHigh}
                </p>
              </>
            )}
            {openFactor.indicatorsLow && (
              <>
                <p className="label label-ink" style={{ marginTop: 4 }}>
                  Looks like, at a low level
                </p>
                <p className="body-soft" style={{ fontSize: 13.5 }}>
                  {openFactor.indicatorsLow}
                </p>
              </>
            )}
            <div className="rule" />
            <p className="label label-ink">Why it was pinned</p>
            <p className="body-soft" style={{ fontSize: 13.5 }}>
              {openFactor.reasoning}
            </p>
            <div className="mt-1.5 flex gap-2.5">
              <button
                type="button"
                className="btn btn-paper"
                style={{ minHeight: 40, fontSize: 11.5, boxShadow: "none" }}
                onClick={() => setOpenFactorId(null)}
              >
                Close
              </button>
            </div>
          </aside>
        )}

        {createError && <p className="body-soft mt-6 text-red-200">{createError}</p>}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
          <span className="body" style={{ color: "var(--mint)", fontSize: 14.5 }}>
            Creates the assessment and its link, and sends it to {email}. One taker; the link lasts 7
            days.
          </span>
          <button
            type="button"
            className="btn btn-primary"
            style={{ minHeight: 52, padding: "0 26px" }}
            disabled={creating}
            onClick={onCreate}
          >
            {creating ? "Creating…" : "Create my assessment"}
          </button>
        </div>
    </WallPage>
  );
}
