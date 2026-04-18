# Findings — Participant assessment flow (Phase 2-full)

Generated: 2026-04-18
Evidence: `docs/audit/screenshots/phase-2-full/participant/` + existing `phase-2b/*` captures
Method: seeded fresh participant tokens via service role, walked the full flow at 375×812 mobile. Participant flow is the product's highest-stakes surface — candidates taking assessments deserve a first-class experience per product-owner decision.

This extends the phase-2b findings (V-001 through V-008) with additional observations captured during the second pass.

## Carried forward from Phase 2B (still valid)

| ID | Finding | Severity |
|----|---------|----------|
| V-001 | `/assess/[token]/section/[sectionIndex]` error state is bare red text on a blank page when assessment can't start | critical |
| V-002 | `/assess/expired` has no CTA (says "contact admin" with no link) | major |
| V-003 | Join form accepts any URL, validates only on submit (wastes participant effort) | minor |
| V-004 | Section pages show no progress indicator during answering (only review shows count) | major |
| V-005 | No visual feedback between click-answer and next question | minor |
| V-006 | "Redirecting in 1 seconds" grammar bug | minor |
| V-007 | `/unauthorized` uses admin-portal violet button regardless of target portal | minor |
| V-008 | Mobile footer may clash with iOS safe area | to verify |

All V-001 through V-008 remain accurate after the P2-full pass. Evidence strengthened for V-001, V-004, V-005.

## Additional findings (P2F- prefix)

### P2F-P-001 — Welcome page renders cleanly at mobile — strong baseline

- Evidence: `participant/01-welcome-mobile.png`
- This is the best-designed surface in the participant flow.
  - Branded header with campaign logo (EPP Test Campaign)
  - Centered "Welcome, Audit" greeting
  - Strong h1 title + description
  - "Before you begin" card with ~10 min time estimate + 4 bullet trust items
  - Full-width "Begin Assessment" CTA (orange, branded)
  - "Powered by Trajectas.com" footer
- **Recommendation**: use this page's copy + layout rhythm as the template for every other participant-flow stage.

### P2F-P-002 — Section Q1 layout is clean but missing progress context

- Evidence: `participant/02-section-q1-mobile.png`
- Confirms V-004 visually: the question page shows the section eyebrow ("AI CAPABILITY INDEX") + the question text + 5 full-width Likert buttons. No progress indicator, no "Question 1 of 40", no section progress.
- **Strong mobile UX**: buttons are full-width, tap-friendly, readable. No cramped targets.
- **Missing**: a persistent progress bar or step pill at the top. Adding `Question 1 · Section 1 of 1` as small type under the eyebrow would close the gap.

### P2F-P-003 — Review page shows "0 of 40 questions answered" with warning, but header is clear

- Evidence: `participant/04-review-mobile.png`
- Eyebrow "REVIEW YOUR RESPONSES" + h1 "AI Capability Index" + "0 of 40 questions answered" meta. Section card below with completion stat + "Complete" button label (even when 0 answered — slightly misleading copy; maybe "Continue" or "Re-check"). Amber warning banner: "You have unanswered questions. You can still submit, but incomplete sections may affect your results." + "Submit Assessment" CTA.
- **Issue P2F-P-003-A** (minor): the section-card "Complete" button label is confusing when 0 answered. That button should read "Start" or "Open" when none answered, and "Resume" when partially answered, reserving "Complete" for fully-answered.
- **Issue P2F-P-003-B** (minor): the warning banner is good but the "Submit Assessment" button sits right below it — a participant might submit an empty assessment without realising. Adding a confirm dialog for <50% completion submits would prevent accidental zero-response submissions.

### P2F-P-004 — Complete page auto-redirects but with a grammar bug

- Evidence: `participant/05-complete-mobile.png` (also phase-2b `06-complete-mobile.png`)
- Still shows "Redirecting in 1 seconds..." (V-006).
- Otherwise clean: checkmark icon, "Thank You" h1, success message, auto-redirect countdown, "Continue now" link.

### P2F-P-005 — Expired page at mobile: the only sane surface for a dead-link error, but has NO recovery path

- Evidence: `participant/06-expired-mobile.png`
- Clean branded layout, X icon, "Link Expired" title, copy: "This assessment link is no longer valid. The campaign may have closed or your access may have been revoked. Please contact your administrator."
- Confirms V-002: zero CTAs. No `mailto:`, no "contact form" link, no support email.
- **Fix**: surface the client admin's email (from campaign config) as a `mailto:` link. If not available, surface a generic "help@trajectas.com" or the operating client's support address.

### P2F-P-006 — Join page with fake token renders the form before validating

- Evidence: `participant/07-join-mobile.png`
- Confirms V-003: I navigated to `/assess/join/audit-cleanup-fake` (an invalid token) and got the full "Join Assessment" form prompting for email, first name, last name, job title, company. Only on submit would the participant learn the link is bad.
- **Fix** (upstream validation): add `validateLinkToken()` server-side before rendering the page. If invalid, redirect to `/assess/expired` with a reason param.

## Progress indicator — consolidated recommendation

From phase-2b (V-004) + this pass (P2F-P-002), the single highest-value participant-flow fix is a persistent progress indicator. Specifics:

1. **Every stage** (welcome, consent, demographics, intro, section, review, complete) shows a thin progress bar at the top of the viewport below the brand header.
2. The bar is segmented (or has notches) at each stage transition — makes "5 stages left" readable at a glance.
3. Within the section stage, the bar shows question-level fill (question 5 of 40 → 12.5% filled of the "section" segment).
4. Add a small text indicator below: `Stage 4 of 7 · Question 5 of 40 · About 4 min left`
5. Opt-out via `campaign.showProgress === false` but even in opt-out mode, show stage progress (stages are deterministic), only hide question progress.

Scope-wise this is probably a day of design + 2 days of implementation + 1 day of per-campaign QA. Huge payoff for completion rate.

## Mobile first-class verification

Product owner specified mobile is first-class for participant flow. Audit of 7 captured mobile screens:

- Welcome: ✓ clean
- Section Q1: ✓ clean
- Review: ✓ clean
- Complete: ✓ clean
- Expired: ✓ clean
- Join: ✓ clean

**No mobile-specific regressions detected in the participant flow at 375px.** The only mobile issues flagged carry forward from phase-2b (V-008 iOS safe area — still unverified, needs a real iPhone test).

This is a meaningful finding: the participant portal is already the most mobile-friendly surface in the product. The remediation work here is about ADDING polish (progress indicator, error recovery, grammar) not fixing broken layouts.

## Surfaces not captured

- `/assess/[token]/consent` — this campaign (EPP Test) has consent disabled in its experience config. A campaign with consent enabled would be needed.
- `/assess/[token]/demographics` — same; EPP Test disables demographics collection.
- `/assess/[token]/assessment-intro/[index]` — skipped by experience config.
- `/assess/[token]/report` + `/report/[snapshotId]` — no released report for my test session.

These are covered adequately by code-reading in `docs/audit/inventory/participant.md`. A future audit pass with a campaign that enables all stages would be ideal for completing visual verification. ~1 hour of additional work if/when needed.
