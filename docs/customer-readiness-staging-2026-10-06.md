# Synthetic staging acceptance

6 October 2026 · [PR #422](https://github.com/jason-zane/trajectas/pull/422) · Development/coaching

**Production is unchanged.** The coordinated rollout is conditionally approved, with Pro or a verified recovery point still pending. Jason requested synthetic staging data only. No production assessment payload was copied locally.

| Check | Result and evidence limit |
|---|---|
| Schema replay | All migration files applied to a separate local Supabase project. This is not a hosted branch or production drift certification. |
| 150-item form | Synthetic form: five dimensions, 25 capabilities, six items each; 75 reverse items. All expected capability scores matched independently: repeating 0, 20, 40, 60, 80, 100. |
| Aggregation | Brain means 40, 44, 48, 52, 56; composite 48. Report payload, HTML and PDF agree. |
| Resume | Reload after 26 saved responses resumed at item 27. |
| Assessment boundaries | Review-enabled first form completed; a fresh review-disabled two-form campaign completed both forms and its participant. Misconfigured follow-up fixture failed processing; a new configured fixture replaced it before administration. |
| Collection | Required country saved with displayed configuration and consent snapshot. Research accepted in one synthetic run and declined in another. Declining allowed completion. |
| Report operations | Cron worker processed two PDFs, zero failures. Final report released, stored PDF ready; participant endpoint returned a nine-page PDF. Representative pages visually inspected after regeneration. |
| Pilot interpretation | Self-reported capability badges; qualified development-pilot, metaphor, illustrative range, absence of real norms and no hiring/significant-growth claims. |
| Client/partner | Existing seeded UI and local integration evidence covers portfolio/client/campaign reads, quota bounds and tenant/membership rules. Full operational OTP, reassignment, report audience, delivery and support walkthrough remains required. |
| Future norms | Unit checks cover sample SD/distributions, first-complete deduplication, incomplete exclusion and incompatible frozen forms. Empirical provenance and publication were not fabricated; synthetic observations do not create real norms. |
| External services | No customer email or paid AI call. Production email-variable names exist, but actual hook/SMTP configuration and provider acceptance were not certified. |
| Recovery | Database/storage restore not rehearsed; user confirmed recovery prerequisite pending. |

Additional staging defects repaired: mode-specific consent copy, memoized concurrent-start recovery, per-assessment estimated duration, report-mode resolution, stable SVG coordinates and cover-label clipping. Targeted resolution/science/flow checks: 27 passed; session-start checks: 15 passed; local TypeScript and changed-source lint passed. Complete CI passed at `057024e1`; subsequent fixes have fresh PR checks.

The sample below contains invented participant, item, capability and dimension data. It demonstrates rendering and arithmetic, and provides no evidence of actual instrument validity or population norms.

