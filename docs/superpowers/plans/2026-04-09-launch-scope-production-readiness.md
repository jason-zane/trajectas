# Launch Scope & Production Readiness Implementation Plan

> **For agentic workers:** Use this plan as the execution source of truth for the April 2026 launch push. Steps use checkbox syntax for tracking. Do not broaden scope without an explicit product decision.

**Goal:** Ship the current app with a narrower, defensible launch scope: no client diagnostics surface, working platform logo upload, and assessment configuration constrained to the scoring modes we actually support.

**Current state:** On the current local worktree, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`, and `npx playwright test tests/e2e/smoke` pass. The remaining launch work is mostly scope control, feature completion, and environment-backed verification.

**Launch decisions baked into this plan:**
- Client diagnostics are deferred and should be inaccessible at launch.
- Platform logo upload should work before launch.
- Assessment scoring should be CTT-only at launch.
- Existing in-flight fixes in the current worktree should be preserved unless they directly conflict with these decisions.

---

## Task 1: Lock Down Client Diagnostics For Launch

**Intent:** Remove client-facing access to unfinished diagnostics routes instead of keeping placeholder access alive.

**Files:**
- Modify: `src/app/client/diagnostics/[id]/page.tsx`
- Modify: `src/app/client/diagnostic-results/[id]/page.tsx`
- Modify: `src/components/workspace-portal-live.tsx`
- Modify: `src/lib/workspace-portal-config.ts`
- Review: `src/components/app-sidebar.tsx`

#### Step-by-step

- [ ] **Step 1: Make direct client diagnostic detail routes inaccessible**

Change the client routes in `src/app/client/diagnostics/[id]/page.tsx` and `src/app/client/diagnostic-results/[id]/page.tsx` to return `notFound()` immediately.

Recommended launch behaviour:
- client diagnostics detail route: `notFound()`
- client diagnostic results detail route: `notFound()`

Do not leave them rendering placeholder config for launch.

- [ ] **Step 2: Remove client-surface diagnostic affordances from live portal views**

In `src/components/workspace-portal-live.tsx`, remove or suppress client-only links and cards that route to:
- `/diagnostics`
- `/diagnostics/[id]`
- `/diagnostic-results`
- `/diagnostic-results/[id]`

Partner diagnostics should remain untouched.

- [ ] **Step 3: Narrow the client portal config to launch scope**

In `src/lib/workspace-portal-config.ts`:
- remove client `diagnostics` and `diagnostic-results` page configs, or
- keep them only if needed for type completeness but ensure nothing in the client surface links to them.

Preferred option: remove them to make the launch boundary explicit.

- [ ] **Step 4: Check for any remaining client diagnostics entry points**

Search for client-surface references to diagnostics and remove or gate them:

```bash
rg -n "diagnostic-results|/diagnostics|diagnostics" src/app/client src/components src/lib
```

Anything that still renders for client users should be either:
- removed,
- hidden behind surface checks, or
- explicitly deferred.

- [ ] **Step 5: Verify launch-safe behaviour**

Run:

```bash
npm run lint
npm run test:coverage
npx playwright test tests/e2e/smoke
```

Manually confirm:
- partner diagnostics still load
- client diagnostics URLs 404
- no client dashboard or portal path links into diagnostics

- [ ] **Step 6: Commit**

```bash
git add src/app/client/diagnostics/\[id\]/page.tsx src/app/client/diagnostic-results/\[id\]/page.tsx src/components/workspace-portal-live.tsx src/lib/workspace-portal-config.ts src/components/app-sidebar.tsx
git commit -m "scope(client): remove deferred diagnostics access from launch surface"
```

---

## Task 2: Ship Platform Logo Upload

**Intent:** Finish the missing platform-brand identity path using the existing uploader and storage pipeline.

**Files:**
- Modify: `src/app/(dashboard)/settings/brand/brand-editor.tsx`
- Modify: `src/app/api/brand-assets/upload/route.ts`
- Review: `src/components/brand-editor/logo-uploader.tsx`
- Review: `src/app/actions/brand.ts`
- Review: `src/lib/brand/types.ts`

#### Step-by-step

- [ ] **Step 1: Fix the platform ownership model for uploads**

`src/app/api/brand-assets/upload/route.ts` currently requires `ownerId` to be a UUID for every upload target. That works for client, partner, and campaign branding, but not for platform branding, where `ownerId` is `null`.

Adjust the route so:
- `platform` uploads do not require a UUID owner ID
- platform uploads write to a stable storage prefix such as `platform/default/...`
- auth remains admin-only for platform uploads

Do not loosen auth for non-platform owner types.

- [ ] **Step 2: Wire the existing logo uploader into the platform brand editor**

In `src/app/(dashboard)/settings/brand/brand-editor.tsx`, replace the current “Logo upload coming soon” placeholder with `LogoUploader`.

The platform editor should support:
- upload new logo
- preview current logo
- clear logo from the draft config
- save the resulting `config.logoUrl` through `upsertBrandConfig`

- [ ] **Step 3: Verify that platform branding flows through the existing consumers**

Confirm the uploaded `logoUrl` is used in the places that already consume brand logo data:
- preview gallery
- email frame
- report surfaces that rely on effective brand resolution

The implementation should not add new brand fields unless strictly necessary.

- [ ] **Step 4: Guard against partial-save confusion**

Ensure the UX makes the state model clear:
- upload updates the draft config immediately
- “Save Changes” persists the brand config record
- removing the logo clears `config.logoUrl`

If needed, add a short caption so the user understands upload is not the same as save.

- [ ] **Step 5: Add or update focused tests if practical**

Minimum acceptable coverage:
- route-level validation for platform upload request shape
- any logic branch that previously rejected platform owner uploads

If route tests are not already present, keep this targeted rather than building a new test harness.

- [ ] **Step 6: Verify end-to-end**

Run:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

Manual check:
- upload platform logo
- save brand config
- reload brand settings page
- confirm preview still shows the uploaded logo

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/settings/brand/brand-editor.tsx src/app/api/brand-assets/upload/route.ts src/components/brand-editor/logo-uploader.tsx
git commit -m "feat(brand): support platform logo upload"
```

---

## Task 3: Collapse Assessment Scoring To CTT-Only

**Intent:** Remove launch-facing references to unsupported scoring modes and enforce the supported mode server-side.

**Files:**
- Modify: `src/app/(dashboard)/assessments/assessment-builder.tsx`
- Modify: `src/lib/validations/assessments.ts`
- Modify: `src/app/actions/assessments.ts` if needed
- Search: any tests or docs referencing IRT or hybrid as launch-available

#### Step-by-step

- [ ] **Step 1: Remove non-CTT scoring choices from the builder UI**

In `src/app/(dashboard)/assessments/assessment-builder.tsx`:
- remove `irt` and `hybrid` from the selectable scoring options
- remove the “coming soon” treatment for scoring mode entirely
- present only the CTT label and description

Preferred launch UX:
- keep the field visible if the explanation adds trust, but render it as a fixed CTT control
- or remove the scoring selector entirely and show a short explanatory note

Do not leave dead options visible.

- [ ] **Step 2: Enforce CTT-only on the server**

In `src/lib/validations/assessments.ts`, change the scoring validation so incoming payloads only allow `ctt`.

Recommended implementation:
- `z.literal('ctt').default('ctt')`

If the action layer still accepts raw payloads from older clients, ensure `createAssessment` and `updateAssessment` cannot persist `irt` or `hybrid`.

- [ ] **Step 3: Check for existing non-CTT records**

Before finalising the change, inspect whether any existing assessments already use non-CTT values.

If such rows exist, choose one of these explicitly:
- migrate them to `ctt` before launch, or
- block launch until their meaning is reviewed

Do not silently strand existing assessments in an unsupported state.

- [ ] **Step 4: Decide whether item selection also needs launch narrowing**

This plan only makes scoring CTT-only because that is the explicit launch decision.

Make a separate product call on whether to:
- keep `fixed` and `rule_based`, or
- collapse item selection to `fixed` as well

If no decision is made, leave item selection unchanged in this task.

- [ ] **Step 5: Update tests and docs to match launch reality**

Search for references implying IRT or hybrid are currently available and align them with the new scope.

Suggested search:

```bash
rg -n "IRT|Hybrid|hybrid|scoring method|coming soon" src tests docs
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run lint
npm run test:coverage
npm run build
```

Manual check:
- create a new assessment
- edit an existing assessment
- confirm only CTT is available and saves cleanly

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/assessments/assessment-builder.tsx src/lib/validations/assessments.ts src/app/actions/assessments.ts
git commit -m "scope(assessments): enforce ctt-only scoring for launch"
```

---

## Task 4: Seeded Validation & Launch Verification

**Intent:** Finish the environment-backed checks that are still outside the local non-seeded gate.

**Files:**
- Review: `README.md`
- Review: `.env.example`

#### Step-by-step

- [ ] **Step 1: Run the seeded end-to-end suite in a Docker-enabled environment**

Run:

```bash
npm run db:test:start
npm run test:e2e:seeded
npm run db:test:stop
```

This is still required for launch-signoff on auth, campaigns, participants, reports/PDFs, and runner flows.

- [ ] **Step 2: Confirm launch environment variables are complete**

Cross-check the deployment environment against `README.md` and `.env.example`, especially:
- `REPORT_PDF_TOKEN_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SUPABASE_AUTH_HOOK_SECRET`
- `TRAJECTAS_CONTEXT_SECRET`
- host and cookie domain settings

- [ ] **Step 3: Verify report PDF access in a deployed-like environment**

Specifically confirm:
- authenticated admin PDF access works
- participant token PDF access works
- direct unauthorised access is rejected

- [ ] **Step 4: Run manual launch smoke**

Minimum manual checks:
- public marketing site loads
- admin dashboard, campaigns, participants, and reports load
- one live assessment can be completed
- one auth email flow works
- one participant invite flow works
- partner and client surfaces resolve correctly on their intended hosts or routed paths

- [ ] **Step 5: Record launch blockers explicitly**

If anything fails in seeded or manual verification, write it down as:
- blocking
- non-blocking but required post-launch
- intentionally deferred

Do not let launch scope drift silently.

---

## Explicitly Deferred After Launch

- [ ] Client diagnostics rollout and client-visible diagnostic results UX
- [ ] Norm-data and 360-data report completeness in `src/lib/reports/runner.ts`
- [ ] Generation soft-delete cleanup in `src/app/actions/generation.ts`
- [ ] Any broader product-surface expansion beyond the launch-safe boundary above

---

## Recommended Execution Order

- [ ] Task 1: Lock down client diagnostics
- [ ] Task 2: Ship platform logo upload
- [ ] Task 3: Collapse assessment scoring to CTT-only
- [ ] Task 4: Run seeded validation and launch smoke

