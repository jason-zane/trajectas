# Phase 2B — Visual verification

Generated: 2026-04-18
Method: Playwright MCP driving local dev server (`localhost:3002`). Mobile viewport 375×812 primary. Desktop 1280×800 for comparison where relevant.
Screenshots: `docs/audit/screenshots/phase-2b/` (12 PNGs)

## Scope

Focused verification of findings from `patterns.md` that code-scan alone couldn't confirm — primarily the participant flow at mobile, plus a few cross-portal anchors (login, unauthorized, assess-expired).

The authenticated participant flow required a valid access token. I inserted a single `campaign_participants` row via the Supabase service role (token prefixed `audit-cleanup-2026-04-18-`, deleted at the end of this session) linked to the existing "EPP Test Campaign" (which already has one assessment, consent/demographics/intro disabled in its experience config).

## Screenshots captured

| # | File | Surface | Viewport | Notes |
|---|------|---------|:--------:|-------|
| 1 | `login-mobile.png` | `/login` | 375 | Clean sign-in card, branded gradient background |
| 2 | `unauthorized-mobile.png` + `unauthorized-desktop.png` | `/unauthorized` | 375 + 1280 | Default admin violet primary (by design per `globals.css`) |
| 3 | `assess-expired-mobile.png` | `/assess/expired` | 375 | Token-invalid error page |
| 4 | `assess-join-fake-token-mobile.png` | `/assess/join/<fake>` | 375 | Form renders BEFORE token validation (validation happens on submit) |
| 5 | `01-welcome-mobile.png` | `/assess/<t>/welcome` | 375 | EPP-branded welcome, "Before you begin" card, ~10 min estimate |
| 6 | `02-section-mobile.png` | `/assess/<t>/section/0` (pre-config) | 375 | **FAILURE STATE** — "Unable to start this assessment right now" |
| 7 | `03-demographics-mobile.png` | `/assess/<t>/section/0` (redirected) | 375 | First assessment question (Likert, 5 buttons) |
| 8 | `04-section-after-answer-mobile.png` | `/assess/<t>/section/0` | 375 | After auto-advance on click; "Back" button appears |
| 9 | `05-review-mobile.png` | `/assess/<t>/review` | 375 | Shows "2 of 40 questions answered", warning banner, Submit button |
| 10 | `06-complete-mobile.png` | `/assess/<t>/complete` | 375 | "Thank You" + auto-redirect countdown |

## Visual findings

### V-001 — "Unable to start this assessment right now" is a bare red string

- **Severity**: **critical**
- **Category**: B3 (error state)
- **Where**: `/assess/[token]/section/[sectionIndex]` when the underlying assessment can't be started (e.g. campaign has 0 assessments, data integrity issue)
- **Screenshot**: `02-section-mobile.png`

When the section route fails to initialise an assessment session, the participant sees a single line of red text on an otherwise-empty page:

> "Unable to start this assessment right now"

No explanation of WHY, no retry button, no "contact support" link, no "back to welcome" action, no branded container. The only visible UI chrome is Next.js dev tools (which wouldn't be there in prod). This is exactly the bare-error surface P-001 predicted — and it happens inside the assessment flow, which is the highest-stakes surface in the product.

**Suggested fix** (layers on P-001):
1. Wrap the section route in an error boundary that renders a branded fallback card ("We couldn't start this assessment. Please contact [admin]. You can try again in a moment.").
2. The error message must include a contact-support pathway since the participant has no other escape hatch.
3. Ideally the underlying integrity check (does the campaign have assessments?) should happen at `/welcome` load and redirect to `/assess/expired` with a specific reason rather than letting the participant click "Begin" only to hit a dead end.

### V-002 — `/assess/expired` has no call-to-action

- **Severity**: major
- **Category**: C3 (where can I go)
- **Where**: `/assess/expired`
- **Screenshot**: `assess-expired-mobile.png`

The copy says "Please contact your administrator" but there is no email link, no phone, no contact form, no "try again" button. A participant who lands here (invalid token, expired campaign, closed access) has literally no next action available on the page.

**Suggested fix**:
1. Add a configurable admin contact method surfaced from the campaign's client config (email link by default).
2. If contact info isn't configured, at minimum add a generic "If this was unexpected, please contact the person who sent you this link." with no magic link — but having a `mailto:` beats nothing.

### V-003 — Join form accepts any URL path before validating token

- **Severity**: minor
- **Category**: B3 / perceived trust
- **Where**: `/assess/join/<any-random-string>`
- **Screenshot**: `assess-join-fake-token-mobile.png`

Navigating to `/assess/join/fake-token-xyz` renders the full join form. Validation happens on submit. A participant who clicks a malformed invite link fills out email/name/company before discovering the link is bad — wasted effort + erosion of trust.

**Suggested fix**:
1. Validate the `linkToken` server-side at route load; if invalid, redirect to `/assess/expired` before rendering the form.
2. This is the same upstream-validation pattern as V-001.

### V-004 — Section pages show no progress indicator at any viewport

- **Severity**: major (confirms P-008)
- **Category**: C2 (where am I)
- **Where**: `/assess/[token]/section/[sectionIndex]`
- **Screenshot**: `03-demographics-mobile.png`, `04-section-after-answer-mobile.png`

Once a participant is answering questions, they see only:
- A section eyebrow ("AI CAPABILITY INDEX")
- The current question
- Answer buttons
- Header with brand logo (+ "Back" button after Q1)

NO "Question N of M", NO progress bar, NO "Section 1 of 3", NO remaining-time estimate. In a 40-question assessment this makes every question feel like it might be the last — or the 100th. The review page (`05-review-mobile.png`) is the only place "2 of 40" appears.

**Suggested fix** (ties to P-008):
1. Render a persistent pill at the top of each section page: `Question 5 · Section 1 of 3`
2. Render a thin progress bar at the very top of the viewport (under the brand header) that fills as questions are answered. This is distinct from `campaign.showProgress` which likely controls section-level progress — add a question-level indicator unconditionally.
3. Also add to the welcome screen: "You'll answer 40 questions across 1 section. Estimated time: 10 minutes." (The ~10 min already shows; questions/sections don't.)

### V-005 — No visual feedback between click-answer and next question

- **Severity**: minor
- **Category**: B5 (perceived performance) / B4 (success)
- **Where**: `/assess/[token]/section/[sectionIndex]` — click-an-answer-button flow

Clicking an answer immediately advances to the next question with no transition, no "✓ Saved", no flash of the chosen answer as selected-then-cleared. On slow connections the participant would experience a moment of "did my click register?" The code appears to rely on the page transition itself as the feedback signal.

**Suggested fix**:
1. Briefly highlight the chosen answer (outline + checkmark) for ~200ms before advancing.
2. On slow connections, show a subtle "Saving…" indicator in the footer instead of nothing.
3. Disable all 5 answer buttons for the moment between click and navigation to prevent double-tap on mobile.

### V-006 — Grammar: "Redirecting in 1 seconds..."

- **Severity**: minor (polish)
- **Category**: content
- **Where**: `/assess/[token]/complete`
- **Screenshot**: `06-complete-mobile.png`

Literal text: `Redirecting in 1 seconds...`. Should use `{n} {n === 1 ? 'second' : 'seconds'}`.

### V-007 — `/unauthorized` button uses admin-portal violet, no portal context

- **Severity**: minor
- **Category**: A3 (colour system)
- **Where**: `/unauthorized`
- **Screenshots**: `unauthorized-mobile.png`, `unauthorized-desktop.png`

The "Back to sign in" primary button renders violet (admin portal default per `--primary` in `globals.css`). This is technically correct (no `data-portal` attribute set on this page), but for a user who was trying to enter the client or partner portal and got bounced here, seeing admin branding is a brief mental hiccup. Low-priority.

**Suggested fix**: If the `reason` searchParam or the previous URL identifies the target portal, set the portal data attribute on the `<html>` to match. If not possible, accept admin violet as the neutral default.

### V-008 — Mobile footer gets partially obscured in dev, need real-device check

- **Severity**: to verify
- **Category**: A4 (responsive)
- **Where**: all assess pages footer
- **Screenshot**: `03-demographics-mobile.png`, `04-section-after-answer-mobile.png`

In my screenshots the "Responses saved automatically" text appears partially under the Next.js dev tools badge. That badge is dev-only and won't appear in production. **However**, the footer IS positioned near the bottom of the viewport in a way that would interact with iOS Safari's URL bar / home indicator. Worth testing on a real device or with Playwright emulation that renders the device chrome.

**Suggested fix**: Add `pb-safe` padding (iOS safe-area inset) to the footer, or test on an actual iPhone.

## Findings that were NOT visually verifiable

Some of the code-scan patterns didn't manifest in the pages I could access:

- **P-004 (reduced-motion)**: the pages I exercised had minimal animation (brand logo, button transitions). A deeper verification needs a page with `ScrollReveal` or `TiltCard`, both of which are in admin/client portals requiring auth.
- **P-001 (missing error.tsx)**: confirmed indirectly via V-001 — the section page clearly has no error boundary because the failure surface was raw red text on blank page.
- **P-002 (PageHeader coverage)**: partially confirmed — participant pages use custom headers (appropriate for this surface), so the 27% number is misleading if you exclude participant + marketing from the denominator. Recalculate on Phase 3 remediation.

## Cleanup

- Test participant row deleted (returned `957b736f-9f5f-4ca8-8906-dfb53e5331ec`).
- No other test data was created. The existing "EPP Test Campaign" was used as-is and is unchanged.

## Phase 2B impact on priorities.md

The visual pass adds three Lane-1 items:

| # | Finding | Severity | Lane |
|---|---------|----------|------|
| V-001 | Assessment section error-state is raw red text | **critical** | 1 |
| V-002 | `/assess/expired` has no CTA | major | 1 |
| V-004 | Section pages lack progress indicator (confirms P-008) | major | 1 (already in) |

V-003 (join-form pre-validation), V-005 (answer-click feedback), V-006 (grammar), V-007 (violet unauthorized), V-008 (safe-area check) are Lane 2 polish items.

Patterns doc + priorities doc remain the source of truth — this phase-2b.md extends them with screenshot-confirmed findings.
