# Partner portal — baseline scorecard

Generated: 2026-04-20
Source: rapid scan of `src/app/partner/` (21 pages) against the codified standards in `docs/ui-standards.md` + primitives that landed during the client-portal uplift.

**Purpose**: same triage as `admin-scorecard.md` — decide per surface whether it matches, needs baseline fix, or needs deferred bespoke work.

---

## Headline result — partner portal is in the cleanest shape of any portal

Partner inherits the workspace shell, primitives, and shared tables from the client portal. Only 21 pages, mostly thin delegations to shared components.

| Area | Status |
|------|:------:|
| Brand tokens | ✅ global |
| Dark mode removal | ✅ **zero `dark:` residue in `partner/`** |
| **`<div onClick>` anti-patterns** | ✅ **zero** |
| Typography — `PageHeader` | ✅ 13 files use it (32 occurrences) |
| `BrandedError` root boundary — `partner/error.tsx` | ✅ uses the primitive |
| DataTable primitive | ✅ 9 files adopt it (62 occurrences) |
| `loading.tsx` coverage | ✅ every surface has one |
| Motion / reduced-motion | ✅ inherited |

---

## Remaining baseline gaps

### P1 — Alert variants not adopted

Zero `Alert variant="warning|info|success"` usages in `partner/`. Any warning/info/success notices (feature-gate reminders, quota notices, preview-mode warnings) are still hand-rolled.

Estimated callsites: **~3–5**. Lower than admin because the surface is smaller.

Effort: ~1h.

### P2 — EmptyState adoption

Zero `<EmptyState>` usages in `partner/`. Every listing page (campaigns, participants, assessments, clients, report-templates) likely has an ad-hoc empty state.

Estimated callsites: **5 listings** + maybe 2 detail-page empty states.

Effort: ~2h.

### P3 — Spot-check detail pages

Partner dashboard, campaign detail, participant detail, session detail — quick visual pass to confirm shared primitives are applied consistently (PageHeader sizing, card hover transitions, etc.). Most surfaces use client-portal's `CampaignDetailShell` or `ParticipantDetailView` so should inherit correctly.

Effort: ~1h.

---

## Bespoke areas — defer to later

| Section | Pages | Notes |
|---------|:----:|-------|
| **Partner dashboard** | 1 | Per product direction, dashboard redesigns come later |
| **Brand settings** | 1 | Feature-gated; behaviour already correct, just needs standards pass |
| **Catch-all `/partner/[[...slug]]`** | 1 | Delegates to `WorkspacePortalPage`; scope-out |
| **Diagnostics `/partner/diagnostics/[id]`** | 1 | Delegates to `WorkspacePortalLivePage`; scope-out |

---

## Recommended sweep order

Partner is small enough to do in a single PR (or two):

1. **P2 + P1** — bundle empty-state + alert variant migrations since both are pure pattern replacements. 1 PR.
2. **P3** — spot-check detail pages; may produce no changes or one tiny polish PR.

**Total estimated effort: 3–4 hours** (well under the 1.5-day plan estimate).

---

## Dependency on admin sweep

Partner shares `CampaignsTable`, `ParticipantsTable`, `AssessmentsTable`, `ReportTemplatesTable`, `BlockBuilderClient`, `AssessmentBuilder` with the admin portal. Any baseline fixes applied in the admin sweep propagate for free.

Therefore: **do the admin sweep first**, then do the partner sweep to catch the residue (empty states, banners that are partner-specific).

---

## Scoped out explicitly

- No redesign of partner dashboard
- No reconsideration of feature-gated surfaces
- No phase-2 screenshot campaign
