# Findings — Deep dives (Phase 2-full supplement)

Generated: 2026-04-18
Evidence: `docs/audit/screenshots/phase-2-full/deep-dives/` (11 captures)
Method: ran `scripts/audit-deep-dives.mjs` which temporarily enabled consent/demographics/review stages on EPP Test Campaign + toggled `can_customize_branding` on Sample Data client, captured, reverted every change.

Scope: FlowEditor keyboard a11y, CampaignForm state transitions, BrandEditor enabled-state, participant flow with additional stages.

## Participant flow — stages newly captured

### DD-P-01 — Consent page surface failures same as V-001 even when enabled

- Evidence: `p-02-consent-mobile.png`
- Behaviour: after enabling consent in `experience_templates.flow_config`, navigating to `/assess/[token]/consent` (or clicking "Begin" from welcome) produces the same bare "Unable to start this assessment right now" red-text error page.
- **Finding**: the error surface V-001 doesn't just trigger on empty-assessments. Enabling consent without completing the per-campaign consent copy config (or some other prerequisite) also triggers it. The error swallows legitimate misconfigurations behind a non-actionable message.
- **Implication**: Lane-1 fix for V-001 (branded error boundary) should ALSO inspect the error source and show differentiated copy: "The campaign's consent step isn't configured yet — please contact the admin." vs "This campaign has no assessments yet."

### DD-P-02 — Demographics page is clean and accessible

- Evidence: `p-03-demographics-mobile.png`
- **Passes**:
  - Branded header ("Executive Performance Partners" logo)
  - "ABOUT YOU" amber eyebrow + "Demographics" h1
  - Explanation copy: "The following information helps us ensure fair and accurate assessment results. All fields are optional unless marked as required."
  - 4 select fields: Age Range, Gender, Education Level, Job Level
  - Full-width orange "Continue" button
  - "Powered by Trajectas.com" footer
- **Issue DD-P-02-A** (minor): native `<select>` elements — limited styling and no search. For demographics with many categories (education level can have 6–10 options) a searchable combobox reads better on mobile. Not critical.
- **Issue DD-P-02-B** (minor): no step indicator here either (same P-008 finding — reinforced).

### DD-P-03 — Review page with review-enabled flag active looks the same

- Evidence: `p-04-review-mobile.png`
- This is the same rendering as `phase-2-full/participant/04-review-mobile.png` — toggling `review.enabled` in flow_config doesn't change the review page UI itself (it controls whether the stage is reached via the normal flow, not whether the page exists).
- No new findings. V-004 reinforced (still no progress indicator).

## Client portal deep dives

### DD-CF-01 — CampaignForm state transitions are clean

- Evidence: `cf-01-empty-desktop.png`, `cf-02-title-filled-desktop.png`, `cf-03-all-filled-desktop.png`
- **Passes**:
  - Empty state shows all sections with clean placeholders, labels, "Create Campaign" submit button visible but passive
  - Typing a Title auto-populates Slug (good: `Audit Deep Dive Test` → `audit-deep-dive-test`)
  - Description textarea shows an orange focus ring when active — confirms focus-visible styling works
  - All-filled state shows completed form with accessible date pickers (browser native `dd/mm/yyyy, --:--`)
- **Issue DD-CF-01-A** (minor): browser-native date inputs — visual consistency suffers on macOS/Windows vs Chromebook. A dedicated date primitive with calendar picker would align with the form's quality. Low-priority polish.
- **No validation errors tested**: script didn't submit; ideally we'd test submit-with-missing-required-fields to verify error state rendering. Added to open gaps below.

### DD-BE-01 — BrandEditor did not flip to "enabled" after DB toggle — cache staleness

- Evidence: `b-01-brand-enabled-desktop.png`
- Behaviour: set `clients.can_customize_branding = true` directly in the DB, signed in fresh, navigated to `/client/settings/brand/client`. The page still renders "Brand customisation is not enabled" empty state — even though the toggle is now `true`.
- **Finding**: the brand-capability check is cached somewhere (Next.js `unstable_cache` tag, React `cache()` memo, or a per-session memo). Toggling the DB value without invalidating the cache leaves the UI stuck in disabled state.
- **Implication for workflow**: when an admin enables branding for a client, the client user may need to sign out/in before seeing the editor. This is a real UX trap — the admin says "it's on" and the client says "no it isn't".
- **Action items**:
  1. Find the cache tag (likely `getCachedClient` or similar) and call `revalidateTag` when `can_customize_branding` updates via the admin tool.
  2. Add a user-facing "Brand customisation was recently enabled — please reload the page if you don't see the editor" hint inline with the disabled copy (defensive).
- **Secondary observation**: a "Preview all client data" context switcher appeared in the top-right after toggling the flag (visible in the screenshot). That's probably because my client user is now seeing multi-client capabilities — not expected on a plain client portal. Another cache/state leak worth investigating.

### DD-FE-01 — FlowEditor has real keyboard-a11y regressions (verified via code reading)

Automated Tab walkthrough was blocked twice — first by auth errors (EPP Test not owned by our client), then by workspace-context-cookie staleness when the headless browser navigated directly to a campaign URL. Rather than fight the scripting, I audited the source code directly — `src/components/flow-editor/flow-page-card.tsx` — which is the FlowEditor's core drag-reorder component. The findings are unambiguous:

- **Line 63-74**: The clickable card wrapper is a plain `<div onClick={onSelect}>`, not a `<button>` or `role="button"` element. **Keyboard users cannot select a page card** — there's no way to focus it, and Enter/Space wouldn't activate it even if they could.
- **Line 63**: Missing `tabIndex={0}` → card is not focusable via Tab.
- **Line 63**: Missing `onKeyDown` handler → no Enter/Space activation even if focus were possible.
- **Line 63**: No `focus-visible:ring-` class → no visual focus indicator.
- **Line 77-85**: The drag handle IS a real `<button>` with `aria-label="Drag to reorder"` — this is correct. But its focus-ring styling relies on the default Button primitive behaviour; the inline `<button>` here doesn't use the Button component and has no explicit focus ring class.
- **Drag-reorder keyboard flow**: `@dnd-kit/react` ships with built-in keyboard sensors + announcements. Assuming those are enabled (they are by default), the drag-and-drop interaction itself IS keyboard-operable — but because the cards aren't selectable via keyboard, a keyboard-only user can't get into the editor at all.

**Fix priority**: major (a11y regression class) — move to Lane 2. Specifically:
1. Change `FlowPageCard`'s wrapper div to a `<button>` OR add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space, and `focus-visible:ring-` styling.
2. Same treatment for the drag handle: use the Button primitive or add explicit `focus-visible:` styling.

**Screenshots from the attempted Playwright run** show the 404/auth-error fallback (`fe-01-default-correct-desktop.png`), not the FlowEditor itself — archive-worthy as evidence of P-001 (missing `client/error.tsx`) but not as FlowEditor evidence. The real FlowEditor screenshot is `../client/07-campaign-experience-desktop.png` from the original desktop capture.

## Additions to priorities-v2.md

Surface these as Lane-1 / Lane-2 items:

| # | Item | Effort | Source |
|---|------|:------:|--------|
| 22 | Differentiated error copy for participant-flow misconfiguration (vs generic "Unable to start") | S (0.5d) | DD-P-01, V-001 |
| 23 | Invalidate brand-capability cache when `can_customize_branding` is toggled | S (0.5d) | DD-BE-01 |
| 24 | FlowEditor: make page-card keyboard-selectable (`<button>` or role+tabIndex+onKeyDown) + visible focus ring | S (0.5d) | DD-FE-01 |

## Cleanup

- `scripts/audit-deep-dives.mjs` reverted EPP Test flow_config + Sample Data `can_customize_branding` at the end of the run
- Test participants (`audit-cleanup-dd-*`) deleted
- Test user (`audit-cleanup-client@trajectas.test`) will be cleaned by `scripts/audit-cleanup-users.mjs` on final pass

## Remaining genuinely untested (Phase 3b)

- **FlowEditor keyboard drag-reorder runtime behaviour** (as opposed to static code a11y): @dnd-kit/react is declared to support keyboard sensors + screen-reader announcements, but I didn't verify the actual announcer output. Worth one focused session with a screen reader once the DD-FE-01 fix lands.
- **CampaignForm validation state** (submit with missing required fields, server error): not exercised in this pass. Easy to add if needed.
- **BrandEditor rendering in truly enabled state**: blocked by DD-BE-01 cache issue. Fix the cache first, then re-capture.
- **Participant report pages** (`/report`, `/report/[snapshotId]`): requires a released snapshot in a campaign the user has access to. No released snapshot exists in Sample Data yet.
- **Consent pages in a fully-configured state**: DD-P-01 confirms the error path. A campaign with properly-configured consent copy would render a real consent page — needs experience-template editing beyond just toggling `enabled`.

None of these block Lane 0 / Lane 1 / Lane 2 remediation. They're nice-to-haves for fuller per-surface evidence.
