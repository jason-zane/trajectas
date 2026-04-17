# Participant assessment UI inventory

Generated: 2026-04-18
Source: `src/app/assess/`

## Summary

- **13 pages** in the participant-facing assessment flow
- **Flow**: join link → welcome → (consent, optional) → (demographics, optional) → assessment-intro → section(s) → review → complete → report
- **Notable**:
  - All `[token]` routes are gated by `validateAccessToken()` — invalid/expired redirects to `/assess/expired`
  - **Forced light theme** on every assessment page via `ForceLightTheme` (no dark-mode variant exists)
  - Brand CSS custom properties are injected server-side at two levels: platform defaults (`assess/layout.tsx`) and campaign overrides (`assess/[token]/layout.tsx`)
  - Flow pages are **experience-configurable** — each stage can be enabled/disabled per campaign; the session redirects to the next enabled stage on completion
  - Navigation is implicit (server redirects), not visible UI — no breadcrumbs, minimal chrome
  - **This flow is high-stakes and public-facing** — a poor participant experience directly impacts assessment completion rates. Warrants its own mini-audit.

## Pages

| # | Route | File | Surface type | Interactive elements | States to capture |
|---|-------|------|--------------|----------------------|-------------------|
| 1 | `/assess/join/[linkToken]` | `src/app/assess/join/[linkToken]/page.tsx` | `form` (single-step) | Email input, submit button | entry, token-invalid |
| 2 | `/assess/[token]/welcome` | `src/app/assess/[token]/welcome/page.tsx` | `detail` | "Begin" or "Resume" CTA, estimated-time display | welcome-fresh, resume-available |
| 3 | `/assess/[token]/consent` | `src/app/assess/[token]/consent/page.tsx` | `form` | Consent checkbox, "I agree" button | not-consented, already-consented (redirect) |
| 4 | `/assess/[token]/demographics` | `src/app/assess/[token]/demographics/page.tsx` | `form` | Dynamic fields (text / select / checkbox per campaign config), submit | incomplete, already-completed (redirect) |
| 5 | `/assess/[token]/assessment-intro/[assessmentIndex]` | `src/app/assess/[token]/assessment-intro/[assessmentIndex]/page.tsx` | `detail` | Prose intro body, "Continue to assessment" button | intro-enabled, intro-suppressed (redirect), override-active |
| 6 | `/assess/[token]/section/[sectionIndex]` | `src/app/assess/[token]/section/[sectionIndex]/page.tsx` | `wizard` | Question items (text / choice / matrix), prev/next, conditional progress indicator | section-loaded, in-progress, error, clamp-protection (invalid index) |
| 7 | `/assess/[token]/review` | `src/app/assess/[token]/review/page.tsx` | `detail` | Jump-to-section links ("Edit answer"), "Submit" button, read-only response summary | review-loaded, no-in-progress (redirect) |
| 8 | `/assess/[token]/complete` | `src/app/assess/[token]/complete/page.tsx` | `detail` | Next-URL CTA (dynamic), auto-submit fallback if review skipped | shown, auto-submit |
| 9 | `/assess/[token]/report` | `src/app/assess/[token]/report/page.tsx` | `detail` | "View report" link (conditional), auto-refresh indicator | pending, generating, released, failed, not-enabled (redirect) |
| 10 | `/assess/[token]/report/[snapshotId]` | `src/app/assess/[token]/report/[snapshotId]/page.tsx` | `print-export` | "Download report" button (PDF), read-only report content | released, not-found |
| 11 | `/assess/[token]/report/export` | `src/app/assess/[token]/report/export/page.tsx` | `redirect` | (PDF render handler) | export-trigger |
| 12 | `/assess/[token]` | `src/app/assess/[token]/page.tsx` | `redirect` | (dispatches to welcome or next enabled stage) | redirect-only |
| 13 | `/assess/expired` | `src/app/assess/expired/page.tsx` | `error-page` | "Contact support" / "Back to login" link | token-invalid, token-expired |

## Overlays triggered from this portal

| # | Trigger location | Component | Overlay type | Purpose |
|---|------------------|-----------|--------------|---------|

**None detected.** The participant flow deliberately avoids modal overlays — all navigation is server-side redirect-driven, validation is inline/toast, and errors route to dedicated pages. This is a sound choice for assessment UX (modals fragment focus).

## Navigation surface

**Chrome:**
- Branded header: logo + campaign name (from `brandConfig.logoUrl` / `brandConfig.name`)
- Section pages: conditional progress indicator (when `campaign.showProgress === true`)
- Footer: Privacy + Terms links (when configured in `experience.privacyUrl` / `experience.termsUrl`), rendered on demographics + join

**Navigation model:**
- **Implicit + server-driven** — participants advance via form submits that trigger server redirects to the next enabled stage
- No explicit step indicators, breadcrumbs, or "go back" affordances beyond browser back
- Progress bar is the only "where am I in the flow" cue

**Theme:**
- `ForceLightTheme` applied at layout — dark mode is NOT available on assessment pages
- Brand colours injected via CSS custom properties; platform defaults overridden per campaign

## Preliminary observations

These are flagged here (not scored) because A4 is pure cataloguing. They feed the mini-audit in a later session:

1. **No visible step indicator on consent/demographics/intro** — participant doesn't know "I'm 2 of 8 steps in" except on question sections (and only when `showProgress` is true). Feels disorienting for long flows.
2. **Flow is redirect-heavy** — every form submit is a server round-trip + redirect. Under slow connections this may feel laggy; no skeletons or perceived-performance scaffolding.
3. **Browser-back behaviour undefined** — linear flow with server state; back button could cause "this section already completed" errors. Needs testing.
4. **No mobile-first signal** — layouts don't obviously differentiate mobile layout in page.tsx files. Since ~50%+ of participants likely take assessments on mobile, this is worth a dedicated mobile audit.
5. **Session resumption UX** — the "resume vs begin" welcome-state is important (participants often pause partway). Worth examining whether state is preserved correctly across section transitions.
6. **Report page has `pending` / `generating` / `failed` states** — good (explicit async states) but the auto-refresh is likely polling; needs UX review of what the participant sees while waiting.
7. **No in-flow help or FAQ** — if a participant has a question mid-assessment, there's no escape hatch short of abandoning.
8. **Only language is English** — no visible i18n for the flow. Worth flagging as a future concern.

## Taxonomy gaps

1. **`form` (single-step)** — used for join, consent, demographics. Not a distinct type in framework Part 1, but sufficient as "page that wraps a form with a submit-and-redirect pattern". **Proposed**: rename to `form-step` or document as sub-type of `editor`. Minor taxonomy issue.
2. **`wizard` at page level** — the `/section/[sectionIndex]` route is a wizard stage rendered as a page. Framework currently lists `wizard` as a page-level type but mostly references `modal-wizard` in practice. Clarify in framework that the page-level wizard type is valid for multi-step linear flows rendered as separate routes (not just modals).

Everything else fits.

## Incomplete

None.
