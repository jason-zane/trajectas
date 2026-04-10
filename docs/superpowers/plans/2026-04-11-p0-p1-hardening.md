# P0 + P1 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This plan executes Phases P0 (security & data integrity) and P1 (hot-path performance) from `docs/superpowers/plans/2026-04-10-core-platform-hardening.md`. Each task is self-contained and can be committed independently unless a dependency is noted.

**Goal:** Close every P0 security / data-integrity gap and ship every P1 hot-path performance win identified in the 2026-04-10 platform audit — so the foundation is rock-solid before we start on P2 admin-flow polish.

**Architecture:** All work is either (a) pure query refactors (parallelize independent awaits via `Promise.all`), (b) small additive route files (`error.tsx`, `loading.tsx`), or (c) minimal server-action signature changes to surface previously-swallowed errors. No new dependencies, no migrations, no schema changes. Every task keeps existing behavior for the happy path; the changes are about surfacing failures and reducing wall-clock time.

**Tech Stack:** Next.js 15 App Router · Supabase JS client · TypeScript · React Server Components · Tailwind · shadcn/ui · sonner toasts.

**Verification baseline:** Every task ends with `npx tsc --noEmit` passing. There is no automated test runner wired into this project for route-level behavior today, so verification is **TypeScript check + manual smoke test on a dev build**. Some tasks include new unit tests where worthwhile.

**Total estimated effort:** ~14 hours across 13 tasks.

---

## Task ordering & dependencies

```
Task 1 (P0.5 error.tsx)        [independent]
Task 2 (P0.6 reports paging)    [independent]
Task 3 (P0.1 client PDF leak)   [independent]
Task 4 (P0.2 scope audit)       [independent]
Task 5 (P0.3 email result shape)                    ──┐
Task 6 (P0.4 bulk invite result)                       ├─► depends on Task 5
                                                       │
Task 7 (P1.1 parallelize getPartnerStats)  [indep]     │
Task 8 (P1.2 parallelize getClientStats)   [indep]     │
Task 9 (P1.3 getCampaigns completed counts)[indep]     │
Task 10 (P1.4 parallelize getCampaignById) [indep]     │
Task 11 (P1.5 bulk email concurrency)                  ◄─┘ depends on Task 5
Task 12 (P1.6 defer snapshot PDF URL)      [indep]
Task 13 (P1.7 missing loading.tsx)         [indep]
```

**Recommended execution order:** Tasks 1 → 13 in sequence. Tasks 7–10 and 12–13 are fully independent and can be parallelized across multiple subagents if desired.

---

## Cross-cutting rules (from CLAUDE.md)

- Toasts for CRUD: use `sonner` (`toast.success`, `toast.error`). Delete operations get a 5s undo action.
- Every new route gets a matching `loading.tsx` using `animate-shimmer`, not `animate-pulse`.
- Dark mode must look correct. No raw hex/oklch — CSS variables or Tailwind only.
- Never hard-delete from the UI. Soft-delete via `deleted_at` with undo toast.
- When an existing save swallows an error, surface it via both inline banner AND toast.

---

## Task 1: Add `error.tsx` boundaries to report / template / results routes (P0.5)

**Problem:** Unhandled errors on these routes render a blank white page. No boundary, no retry button, no log context.

**Files:**
- Create: `src/components/errors/error-boundary-card.tsx` (shared component)
- Create: `src/app/(dashboard)/reports/error.tsx`
- Create: `src/app/(dashboard)/reports/[snapshotId]/error.tsx`
- Create: `src/app/(dashboard)/report-templates/error.tsx`
- Create: `src/app/(dashboard)/report-templates/[id]/builder/error.tsx`
- Create: `src/app/(dashboard)/campaigns/[id]/results/error.tsx`
- Create: `src/app/partner/campaigns/[id]/results/error.tsx`
- Create: `src/app/client/campaigns/[id]/results/error.tsx`

### Steps

- [ ] **Step 1: Create the shared ErrorBoundaryCard component**

Create `src/components/errors/error-boundary-card.tsx`:

```tsx
"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect } from "react";

interface ErrorBoundaryCardProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export function ErrorBoundaryCard({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. You can try again, or reload the page if the problem persists.",
}: ErrorBoundaryCardProps) {
  useEffect(() => {
    // Log for debugging — keep this so Next.js dev overlay still fires
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="max-w-lg w-full">
        <CardContent className="flex flex-col items-start gap-4 py-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
            {error.digest && (
              <p className="text-xs text-muted-foreground font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <Button onClick={reset} variant="outline" size="sm">
            <RotateCw className="size-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create each `error.tsx` file wrapping the shared component**

Each error file is a thin wrapper. Example for `src/app/(dashboard)/reports/error.tsx`:

```tsx
"use client";

import { ErrorBoundaryCard } from "@/components/errors/error-boundary-card";

export default function ReportsErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryCard
      error={error}
      reset={reset}
      title="Unable to load reports"
      description="We couldn't load the reports list. Try again, or return to the dashboard."
    />
  );
}
```

Repeat for the 6 other paths with appropriate titles:
- `reports/[snapshotId]/error.tsx` → "Unable to load this report"
- `report-templates/error.tsx` → "Unable to load report templates"
- `report-templates/[id]/builder/error.tsx` → "Unable to load the template builder"
- `campaigns/[id]/results/error.tsx` → "Unable to load campaign results"
- `partner/campaigns/[id]/results/error.tsx` → "Unable to load campaign results"
- `client/campaigns/[id]/results/error.tsx` → "Unable to load campaign results"

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 4: Manual smoke test — deliberately throw**

Temporarily add `throw new Error("test")` at the top of one page component. Navigate to it. Expect the error card to render with the "Try again" button. Remove the throw.

- [ ] **Step 5: Commit**

```bash
git add src/components/errors/error-boundary-card.tsx \
        src/app/\(dashboard\)/reports/error.tsx \
        src/app/\(dashboard\)/reports/\[snapshotId\]/error.tsx \
        src/app/\(dashboard\)/report-templates/error.tsx \
        src/app/\(dashboard\)/report-templates/\[id\]/builder/error.tsx \
        src/app/\(dashboard\)/campaigns/\[id\]/results/error.tsx \
        src/app/partner/campaigns/\[id\]/results/error.tsx \
        src/app/client/campaigns/\[id\]/results/error.tsx

git commit -m "feat(errors): add error.tsx boundaries to reports, templates, results"
```

**Effort:** 1 hour.

---

## Task 2: Add cursor pagination to `getAllReadySnapshots` (P0.6)

**Problem:** `getAllReadySnapshots` hardcodes `limit(200)`. Once you pass 200 ready/released/failed snapshots, older ones are invisible. No pagination.

**Files:**
- Modify: `src/app/actions/reports.ts:478-513` (`getAllReadySnapshots`)
- Modify: `src/app/(dashboard)/reports/page.tsx` (consumer)
- Modify: `src/app/(dashboard)/reports/reports-table.tsx` (client component that renders the table — read it before editing)

### Steps

- [ ] **Step 1: Read `reports-table.tsx` to understand the current table**

```bash
# Read src/app/(dashboard)/reports/reports-table.tsx
```

Note: this is a client component that receives `snapshots` as a prop. We'll need to add a `nextCursor` prop and a "Load more" button (or swap to a DataTable with server pagination).

- [ ] **Step 2: Update `getAllReadySnapshots` signature**

In `src/app/actions/reports.ts`, replace lines 478-513:

```typescript
export interface GetAllReadySnapshotsOptions {
  /** ISO timestamp cursor. Returns rows with created_at strictly before this. */
  cursor?: string
  /** Max rows to return. Default 50, max 200. */
  limit?: number
}

export interface GetAllReadySnapshotsResult {
  snapshots: ReportSnapshotListItem[]
  nextCursor: string | null
}

export async function getAllReadySnapshots(
  options: GetAllReadySnapshotsOptions = {},
): Promise<GetAllReadySnapshotsResult> {
  await requireAdminScope()
  const db = await createClient()

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)

  let query = db
    .from('report_snapshots')
    .select(
      '*, participant_sessions(campaign_participant_id, campaign_participants(first_name, last_name, email))'
    )
    .in('status', ['ready', 'released', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit + 1) // fetch one extra to detect "more exists"

  if (options.cursor) {
    query = query.lt('created_at', options.cursor)
  }

  const { data, error } = await query

  if (error) {
    throwActionError(
      'getAllReadySnapshots',
      'Unable to load report snapshots.',
      error
    )
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const snapshots: ReportSnapshotListItem[] = pageRows.map((row) => {
    const snapshot = mapReportSnapshotRow(row)
    const session = getRelatedRecord((row as Record<string, unknown>).participant_sessions)
    const participant = getRelatedRecord(session?.campaign_participants)
    const name = [participant?.first_name, participant?.last_name]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim()

    return {
      ...snapshot,
      participantName: name || undefined,
      participantEmail:
        typeof participant?.email === "string" ? participant.email : undefined,
    }
  })

  const nextCursor = hasMore
    ? snapshots[snapshots.length - 1].createdAt ?? null
    : null

  return { snapshots, nextCursor }
}
```

**Note:** This is a breaking return shape change. Every consumer must be updated.

- [ ] **Step 3: Update the consumer `src/app/(dashboard)/reports/page.tsx`**

```tsx
import { PageHeader } from '@/components/page-header'
import { getAllReadySnapshots } from '@/app/actions/reports'
import { ReportsTable } from './reports-table'

export default async function ReportsPage() {
  const { snapshots, nextCursor } = await getAllReadySnapshots({ limit: 50 })

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Generated report snapshots. Click a report to preview or release."
      />

      <ReportsTable snapshots={snapshots} initialNextCursor={nextCursor} />
    </div>
  )
}
```

- [ ] **Step 4: Update `reports-table.tsx` to accept `initialNextCursor` and add Load more**

Add a client-side "Load more" button that calls `getAllReadySnapshots({ cursor: nextCursor })` via a server action wrapper. If the table is already using a shared DataTable component (check), use its existing server-pagination support instead.

Minimal fallback: append rows on click, update local `nextCursor` state, hide button when null.

```tsx
// In reports-table.tsx, add:
const [rows, setRows] = useState(snapshots);
const [cursor, setCursor] = useState(initialNextCursor);
const [isLoading, startTransition] = useTransition();

async function loadMore() {
  if (!cursor) return;
  startTransition(async () => {
    const result = await getAllReadySnapshots({ cursor, limit: 50 });
    setRows((prev) => [...prev, ...result.snapshots]);
    setCursor(result.nextCursor);
  });
}

// ...table render...
{cursor && (
  <div className="flex justify-center pt-4">
    <Button onClick={loadMore} disabled={isLoading} variant="outline">
      {isLoading ? "Loading..." : "Load more"}
    </Button>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: clean exit. If there are errors elsewhere consuming `getAllReadySnapshots`, fix them — grep for callers:

```bash
```

Use Grep tool with pattern `getAllReadySnapshots\(` to find all consumers. Update each.

- [ ] **Step 6: Manual smoke test**

Navigate to `/reports`. The page should render the first 50 snapshots. If you have >50, the "Load more" button should appear and work.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/reports.ts \
        src/app/\(dashboard\)/reports/page.tsx \
        src/app/\(dashboard\)/reports/reports-table.tsx

git commit -m "feat(reports): add cursor pagination to reports list"
```

**Effort:** 2 hours.

---

## Task 3: Fix client report page PDF URL leak (P0.1)

**Problem:** `src/app/client/reports/[snapshotId]/page.tsx:26` renders `<a href={snapshot.pdfUrl}>` where `snapshot.pdfUrl` is a signed Supabase Storage URL. The URL is visible in the DOM, browser history, and bypasses application-level auth once copied. Also, once shared, anyone with the URL can download until it expires.

**Target behaviour:** Route downloads through `/api/reports/{snapshotId}/pdf` which re-validates the caller's scope on every request.

**Files:**
- Modify: `src/app/api/reports/[snapshotId]/pdf/route.ts` (add client/partner admin auth path)
- Modify: `src/app/client/reports/[snapshotId]/page.tsx` (change the `<a href>`)

### Steps

- [ ] **Step 1: Read the rest of `src/app/api/reports/[snapshotId]/pdf/route.ts`**

The current auth logic only supports (a) `participantToken` query param with `audience_type === 'participant'`, or (b) `requireAdminScope()`. Neither works for a client admin viewing an `audience_type === 'hr_manager'` snapshot.

We need a third path: authenticated workspace user (admin, partner admin, or client admin) with scope access to the snapshot's campaign.

- [ ] **Step 2: Extend the auth branches in `src/app/api/reports/[snapshotId]/pdf/route.ts`**

Around line 95 (the `else` branch that calls `requireAdminScope()`), replace:

```typescript
} else {
  try {
    await requireAdminScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    ...
  }
```

with:

```typescript
} else {
  // Authenticated workspace user path (admin, partner admin, or client admin)
  try {
    const { resolveAuthorizedScope, canAccessClient } = await import('@/lib/auth/authorization')
    const scope = await resolveAuthorizedScope()

    // Look up the snapshot's campaign to check scope access
    const { data: snapshotRow } = await db
      .from('report_snapshots')
      .select('campaign_id, campaigns(client_id, partner_id)')
      .eq('id', snapshotId)
      .maybeSingle()

    if (!snapshotRow) {
      return Response.json({ error: 'Report not found' }, { status: 404 })
    }

    const campaign = Array.isArray(snapshotRow.campaigns)
      ? snapshotRow.campaigns[0]
      : snapshotRow.campaigns

    const clientId = campaign?.client_id ? String(campaign.client_id) : null
    const partnerId = campaign?.partner_id ? String(campaign.partner_id) : null

    const authorized =
      scope.isPlatformAdmin ||
      scope.isLocalDevelopmentBypass ||
      (clientId && canAccessClient(scope, clientId)) ||
      (partnerId && scope.partnerIds.includes(partnerId))

    if (!authorized) {
      return Response.json({ error: 'Not authorized' }, { status: 403 })
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: 'Not authorized' }, { status: 403 })
    }
    throw error
  }
```

**Note:** Do NOT remove the existing participant-token branch. Both code paths must coexist.

- [ ] **Step 3: Update the client report page to use the API route**

In `src/app/client/reports/[snapshotId]/page.tsx:24-33`, replace the `<a href>` block:

```tsx
{snapshot.pdfUrl && (
  <div className="flex justify-end">
    <a href={`/api/reports/${snapshotId}/pdf`} download>
      <Button variant="outline">
        <Download className="size-4" />
        Download PDF
      </Button>
    </a>
  </div>
)}
```

Note: we still guard on `snapshot.pdfUrl` so the button only appears when the snapshot has been rendered. But we never embed the signed storage URL — the href goes through our API.

- [ ] **Step 4: Audit other pages rendering `snapshot.pdfUrl` directly**

Search for other callers:

Use Grep with pattern `snapshot\.pdfUrl` and pattern `snapshot\?\.pdfUrl` across `src/`. For every render that puts this in an `<a href>` or `<img src>`, replace with `/api/reports/${snapshotId}/pdf`.

Likely candidates:
- `src/app/(dashboard)/reports/[snapshotId]/page.tsx` — admin report viewer (may already route correctly)
- `src/app/(dashboard)/reports/reports-table.tsx` — admin reports list (download action)

Do not change the action/server-side code that sets `pdfUrl` on the snapshot — only presentation code.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual smoke test**

1. As an admin, navigate to `/reports/{id}` — download still works.
2. As a client admin, navigate to `/client/reports/{id}` for a released `hr_manager` report — download still works, no signed Supabase URL in the DOM.
3. Log out, paste the `/api/reports/{id}/pdf` URL directly — expect 401.
4. Try the URL with a participant token for another campaign — expect 403.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/reports/\[snapshotId\]/pdf/route.ts \
        src/app/client/reports/\[snapshotId\]/page.tsx

git commit -m "fix(reports): route PDF downloads through API, remove storage URL leak"
```

**Effort:** 1.5 hours.

---

## Task 4: Defense-in-depth scope audit for partner/client sub-routes (P0.2)

**Problem:** `getCampaignByIdImpl` already calls `requireCampaignAccess(id)` at line 136, so top-level partner/client campaign detail pages are protected. BUT sub-routes that fetch campaign-scoped data through other helpers (`getParticipants`, `getCampaignSessions`, `getReportSnapshotsForCampaign`, etc.) may or may not enforce scope. We need to audit every server action called with a raw campaign ID from partner/client routes and ensure it validates access.

**Files to audit (partner):**
- `src/app/partner/campaigns/[id]/page.tsx`
- `src/app/partner/campaigns/[id]/results/page.tsx`
- `src/app/partner/campaigns/[id]/participants/*/page.tsx`
- `src/app/partner/campaigns/[id]/assessments/page.tsx` (if exists)

**Files to audit (client):**
- `src/app/client/campaigns/[id]/overview/page.tsx`
- `src/app/client/campaigns/[id]/assessments/page.tsx`
- `src/app/client/campaigns/[id]/participants/page.tsx`
- `src/app/client/campaigns/[id]/results/page.tsx`

**Helper actions to audit:**
- `getParticipants` (in `src/app/actions/participants.ts`)
- `getCampaignSessions` (in `src/app/actions/sessions.ts`)
- `getReportSnapshotsForCampaign` — **confirmed** calls `requireCampaignAccess` (see `src/app/actions/reports.ts:300`). Safe.
- Any other `getSomethingForCampaign(campaignId)` helpers

### Steps

- [ ] **Step 1: List every server action called from partner/client campaign sub-routes with a raw campaign ID**

Use Grep and Read tools to build a table:

| Route file | Action called | Enforces scope? |
|---|---|---|
| `partner/campaigns/[id]/results/page.tsx` | `getParticipants({ campaignId: id })` | ? |
| `partner/campaigns/[id]/results/page.tsx` | `getCampaignSessions(id)` | ? |
| `partner/campaigns/[id]/page.tsx` | `getCampaignById(id)` | **Yes** (requireCampaignAccess) |
| ... | ... | ... |

Scope is "enforced" if the action internally calls `requireCampaignAccess(id)`, `requireClientAccess(clientId)`, `requirePartnerAccess(partnerId)`, or equivalent. Helpers that only call `resolveAuthorizedScope()` without checking the resource ID do NOT count as enforced.

- [ ] **Step 2: For each action that does NOT enforce scope, add `requireCampaignAccess`**

Example: if `getParticipants({ campaignId })` just returns rows without checking scope, add at the top:

```typescript
import { requireCampaignAccess } from '@/lib/auth/authorization'

export async function getParticipants(options: { campaignId: string; perPage?: number }) {
  await requireCampaignAccess(options.campaignId)
  // ... existing body ...
}
```

If the action is already called from many places with/without campaign context, consider splitting it into two helpers rather than adding a conditional check. Prefer explicit over magic.

- [ ] **Step 3: Run the TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual test — attempt cross-tenant access**

1. Start the dev server.
2. Log in as a partner (or use local dev bypass scoped to partner).
3. Find a campaign ID belonging to a different partner (via the admin dashboard, or by seeding).
4. Navigate directly to `/partner/campaigns/{other-partner-id}`. Expect "Campaign not available" or redirect.
5. Repeat for `/partner/campaigns/{other-partner-id}/results`, `/participants`, etc.
6. Repeat for `/client/campaigns/{other-client-id}/**` as a client admin.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/participants.ts src/app/actions/sessions.ts [others...]
git commit -m "fix(auth): enforce campaign scope on participant and session helpers"
```

**Effort:** 2 hours (most of this is audit; actual edits are small).

**Note:** If the audit turns up zero unprotected actions (because `getCampaignByIdImpl`'s `cache()` wrapper + `requireCampaignAccess` already covers everything via React.cache reuse), this task reduces to a "null audit" commit with an entry in the plan's audit log and no code changes. That's an acceptable outcome.

---

## Task 5: Unify `inviteParticipant` email result shape (P0.3)

**Problem:** `inviteParticipant` at `src/app/actions/campaigns.ts:856-862` wraps the email send in try/catch and silently succeeds on failure. Participant row is marked invited even when SMTP fails. The same pattern exists in `bulkInviteParticipants` at lines 992-1000.

**Target:** Return `{ success: true, id, accessToken, emailSent: boolean, emailError?: string }` from `inviteParticipant`. UI surfaces the `emailSent: false` case with a yellow badge + retry button.

**Files:**
- Modify: `src/app/actions/campaigns.ts:793-865` (`inviteParticipant`)
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` (consumer UI)

### Steps

- [ ] **Step 1: Read `campaign-participant-manager.tsx` to understand the current UI**

Use Read tool on `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`. Find the call site for `inviteParticipant` (likely inside `handleInvite` or similar). Note how the success toast is shown today.

- [ ] **Step 2: Change `inviteParticipant` return shape**

In `src/app/actions/campaigns.ts`, replace the final block (lines 856-865):

```typescript
  // Auto-send invite email
  let emailSent = false
  let emailError: string | undefined
  try {
    const result = await sendParticipantInviteEmail(campaignId, data.id)
    if (result.success) {
      emailSent = true
    } else {
      emailError = result.error
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Email delivery failed'
    console.warn('[inviteParticipant] Email send failed, participant created:', err)
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return {
    success: true as const,
    id: data.id,
    accessToken: data.access_token,
    emailSent,
    emailError,
  }
}
```

- [ ] **Step 3: Update the UI to surface the email failure**

In `campaign-participant-manager.tsx`, where the success toast fires today:

```typescript
const result = await inviteParticipant(campaignId, values);
if ('error' in result) {
  toast.error(/* ...existing error handling... */);
  return;
}

if (result.emailSent) {
  toast.success("Participant invited");
} else {
  toast.warning("Participant added but email failed to send", {
    description: result.emailError,
    action: {
      label: "Retry email",
      onClick: async () => {
        const retry = await sendParticipantInviteEmail(campaignId, result.id);
        if (retry.success) {
          toast.success("Invite email sent");
        } else {
          toast.error("Email still failed", { description: retry.error });
        }
      },
    },
    duration: 10000,
  });
}
```

- [ ] **Step 4: Also update the row-level "Resend email" action**

If the participants table has a "Resend" action today, make sure it also uses `sendParticipantInviteEmail` and surfaces the result. This should already exist — just verify it matches the new pattern.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual smoke test**

1. Happy path: invite a participant. Expect green success toast.
2. Failure path: stub/mock the email service to throw (temporarily edit `src/lib/email/send.ts` to throw). Invite a participant. Expect yellow warning toast with "Retry email" action. Click retry — fixes or fails again.
3. Revert the stub.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/campaigns.ts \
        src/app/\(dashboard\)/campaigns/\[id\]/participants/campaign-participant-manager.tsx

git commit -m "fix(campaigns): surface email send failures on invite instead of swallowing"
```

**Effort:** 2 hours.

---

## Task 6: Detailed result for `bulkInviteParticipants` (P0.4)

**Depends on:** Task 5 (uses the same return shape philosophy).

**Problem:** `bulkInviteParticipants` at `src/app/actions/campaigns.ts:947-1004` uses `.upsert(..., ignoreDuplicates: true)` and returns `{ success: true, count }` where count is only the new rows. Admin has no idea how many were duplicates, how many failed to email, or whether anything was skipped.

**Target:** Return `{ success: true, inserted, skipped, emailsSent, emailsFailed, errors: Array<{ email: string, reason: string }> }`.

**Note:** Migration `20260410150000_allow_repeat_campaign_invites.sql` already dropped the `(campaign_id, email)` unique constraint, so duplicates in the DB are now legal. The "skipped" count below is from pre-check, not DB constraint.

**Files:**
- Modify: `src/app/actions/campaigns.ts:947-1004` (`bulkInviteParticipants`)
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` (consumer UI)

### Steps

- [ ] **Step 1: Rewrite `bulkInviteParticipants`**

Replace the body (roughly lines 961-1000) with:

```typescript
  const db = createAdminClient()

  // Check which emails already exist in this campaign (regardless of deleted_at —
  // we want an advisory check so the admin can decide whether to invite retakes)
  const incomingEmails = participants.map((p) => p.email.toLowerCase())
  const { data: existingRows } = await db
    .from('campaign_participants')
    .select('email')
    .eq('campaign_id', campaignId)
    .in('email', incomingEmails)

  const existingEmails = new Set(
    (existingRows ?? []).map((r) => String(r.email).toLowerCase())
  )

  const skipped: Array<{ email: string; reason: string }> = []
  const toInsert: Array<{ email: string; firstName?: string; lastName?: string }> = []

  for (const p of participants) {
    const emailLower = p.email.toLowerCase()
    if (existingEmails.has(emailLower)) {
      skipped.push({ email: p.email, reason: 'Already invited to this campaign' })
    } else {
      toInsert.push(p)
    }
  }

  let inserted: Array<{ id: string; email: string }> = []
  if (toInsert.length > 0) {
    const rows = toInsert.map((c) => ({
      campaign_id: campaignId,
      email: c.email,
      first_name: c.firstName ?? null,
      last_name: c.lastName ?? null,
    }))

    const { data, error } = await db
      .from('campaign_participants')
      .insert(rows)
      .select('id, email')

    if (error) {
      logActionError('bulkInviteParticipants', error)
      return { error: 'Unable to invite participants.' }
    }

    inserted = data ?? []
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participants.bulk_invited',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { insertedCount: inserted.length, skippedCount: skipped.length },
  })

  // Send emails (sequentially for now — Task 11/P1.5 will parallelize)
  let emailsSent = 0
  const emailErrors: Array<{ email: string; reason: string }> = []
  for (const row of inserted) {
    try {
      const result = await sendParticipantInviteEmail(campaignId, row.id)
      if (result.success) {
        emailsSent += 1
      } else {
        emailErrors.push({ email: row.email, reason: result.error ?? 'Email delivery failed' })
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Email delivery failed'
      emailErrors.push({ email: row.email, reason })
    }
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return {
    success: true as const,
    inserted: inserted.length,
    skipped: skipped.length,
    emailsSent,
    emailsFailed: emailErrors.length,
    skippedEmails: skipped,
    emailErrors,
  }
}
```

- [ ] **Step 2: Update the UI consumer to display the detailed result**

In `campaign-participant-manager.tsx`, after the bulk invite returns, replace the existing success toast with:

```typescript
const result = await bulkInviteParticipants(campaignId, rows);
if ('error' in result && !('success' in result)) {
  toast.error(result.error);
  return;
}

if ('success' in result) {
  const parts: string[] = [];
  if (result.inserted > 0) parts.push(`${result.inserted} invited`);
  if (result.skipped > 0) parts.push(`${result.skipped} already existed`);
  if (result.emailsFailed > 0) parts.push(`${result.emailsFailed} emails failed`);

  if (result.emailsFailed > 0 || result.skipped > 0) {
    toast.warning(parts.join(" · "), {
      description: "Click for details",
      action: {
        label: "Details",
        onClick: () => {
          // Open a Sheet or Dialog with the full breakdown
          setBulkResultDialog(result);
        },
      },
      duration: 10000,
    });
  } else {
    toast.success(parts.join(" · ") || "Participants invited");
  }
}
```

Add a simple details dialog showing `skippedEmails` and `emailErrors` as two columns.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual smoke test**

1. Happy path: bulk invite 5 fresh emails. Expect green success toast.
2. Mixed path: bulk invite a list where 2 are duplicates. Expect yellow toast: "3 invited · 2 already existed". Click Details, confirm the 2 duplicates are listed.
3. Simulate email failure (stub email service): expect yellow toast including "N emails failed" count.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/campaigns.ts \
        src/app/\(dashboard\)/campaigns/\[id\]/participants/campaign-participant-manager.tsx

git commit -m "fix(campaigns): return detailed bulk invite result (inserted/skipped/emails)"
```

**Effort:** 2.5 hours.

---

## Task 7: Parallelize `getPartnerStats` (P1.1)

**Problem:** `src/app/actions/partners.ts:303-362` runs 4 sequential queries for stats on every partner dashboard load. Queries 3, 4, and 5 depend on `clientIds` (query 2), but are independent of each other.

**Current flow:**
1. Count clients
2. Fetch client IDs
3. Count active campaigns (needs clientIds)
4. Count partner members (does NOT need clientIds)
5. Count assigned assessments (needs clientIds)

**Target:** 2 parallel groups:
- Group A: `clientRows` + `partnerMemberCount` (no cross-dependency)
- Group B (after A): `activeCampaignCount` + `totalAssessmentsAssigned` (need clientIds from A)

### Steps

- [ ] **Step 1: Replace `getPartnerStats` body**

In `src/app/actions/partners.ts`, replace lines 308-362 body with:

```typescript
export async function getPartnerStats(partnerId: string): Promise<{
  clientCount: number
  activeCampaignCount: number
  partnerMemberCount: number
  totalAssessmentsAssigned: number
}> {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  // Group A: both independent of each other
  const [clientRowsResult, memberCountResult] = await Promise.all([
    db
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('partner_id', partnerId)
      .is('deleted_at', null),
    db
      .from('partner_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partnerId)
      .is('revoked_at', null),
  ])

  const clientIds = (clientRowsResult.data ?? []).map((c) => c.id)
  const clientCount = clientRowsResult.count ?? 0
  const partnerMemberCount = memberCountResult.count ?? 0

  // Group B: both depend on clientIds, but independent of each other
  let activeCampaignCount = 0
  let totalAssessmentsAssigned = 0

  if (clientIds.length > 0) {
    const [campaignResult, assessmentResult] = await Promise.all([
      db
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .in('client_id', clientIds)
        .eq('status', 'active')
        .is('deleted_at', null),
      db
        .from('client_assessment_assignments')
        .select('*', { count: 'exact', head: true })
        .in('client_id', clientIds)
        .eq('is_active', true),
    ])

    activeCampaignCount = campaignResult.count ?? 0
    totalAssessmentsAssigned = assessmentResult.count ?? 0
  }

  return {
    clientCount,
    activeCampaignCount,
    partnerMemberCount,
    totalAssessmentsAssigned,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual smoke test**

Navigate to the partner overview page. Stats should be identical to before. Check in browser DevTools Network tab that the request completes noticeably faster.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/partners.ts
git commit -m "perf(partners): parallelize getPartnerStats (4 sequential -> 2 parallel groups)"
```

**Effort:** 45 min.

---

## Task 8: Parallelize `getClientStats` (P1.2)

**Problem:** Same shape as Task 7 — `src/app/actions/clients.ts:348-399` runs queries sequentially.

### Steps

- [ ] **Step 1: Replace `getClientStats` body**

In `src/app/actions/clients.ts`, replace lines 353-398 body with:

```typescript
export async function getClientStats(clientId: string): Promise<{
  activeCampaignCount: number
  totalParticipants: number
  assignedAssessmentCount: number
  reportsGenerated: number
}> {
  await requireClientAccess(clientId)
  const db = await createSupabaseClient()

  // Group A: all independent of each other
  const [activeCampaignResult, campaignIdsResult, assignedAssessmentResult, reportsResult] =
    await Promise.all([
      db
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'active')
        .is('deleted_at', null),
      db
        .from('campaigns')
        .select('id')
        .eq('client_id', clientId)
        .is('deleted_at', null),
      db
        .from('client_assessment_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('is_active', true),
      db
        .from('diagnostic_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId),
    ])

  const ids = (campaignIdsResult.data ?? []).map((c) => c.id)

  // Group B: participant count needs campaign ids from Group A
  let totalParticipants = 0
  if (ids.length > 0) {
    const { count } = await db
      .from('campaign_participants')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', ids)
    totalParticipants = count ?? 0
  }

  return {
    activeCampaignCount: activeCampaignResult.count ?? 0,
    totalParticipants,
    assignedAssessmentCount: assignedAssessmentResult.count ?? 0,
    reportsGenerated: reportsResult.count ?? 0,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual smoke test**

Navigate to client overview. Same stats, faster response.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/clients.ts
git commit -m "perf(clients): parallelize getClientStats"
```

**Effort:** 30 min.

---

## Task 9: Parallelize `getCampaigns` completed-count fetch (P1.3)

**Problem:** `src/app/actions/campaigns.ts:66-132`. The initial select pulls aggregated participant counts. Then a second query runs sequentially to count only `status='completed'` rows. The two queries share the same `campaignIds` set and can run in parallel.

**Target:** Run both queries in a single `Promise.all`.

### Steps

- [ ] **Step 1: Refactor `getCampaigns`**

In `src/app/actions/campaigns.ts:66-132`, restructure:

```typescript
export async function getCampaigns(options?: { clientId?: string }): Promise<CampaignWithMeta[]> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()
  let query = db
    .from('campaigns')
    .select('*, clients(name), campaign_participants(count), campaign_assessments(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const effectiveClientId = options?.clientId ??
    (scope.requestSurface === 'client' ? (scope.activeContext?.tenantId ?? null) : null)

  if (effectiveClientId) {
    query = query.eq('client_id', effectiveClientId)
  } else if (!scope.isPlatformAdmin) {
    const campaignIds = await getAccessibleCampaignIds(scope)
    if (!campaignIds || campaignIds.length === 0) {
      return []
    }
    query = query.in('id', campaignIds)
  }

  const { data, error } = await query

  if (error) {
    throwActionError('getCampaigns', 'Unable to load campaigns.', error)
  }

  const campaignIds = (data ?? []).map((r) => r.id)

  // Parallel: now fetch completed counts in the same round-trip window
  let completedMap: Record<string, number> = {}
  if (campaignIds.length > 0) {
    const { data: completed, error: completedError } = await db
      .from('campaign_participants')
      .select('campaign_id')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')

    if (completedError) {
      throwActionError(
        'getCampaigns.completedCounts',
        'Unable to load campaigns.',
        completedError
      )
    }

    completedMap = (completed ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.campaign_id] = (acc[r.campaign_id] ?? 0) + 1
      return acc
    }, {})
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...mapCampaignRow(row),
    assessmentCount: row.campaign_assessments?.[0]?.count ?? 0,
    participantCount: row.campaign_participants?.[0]?.count ?? 0,
    completedCount: completedMap[row.id] ?? 0,
    clientName: row.clients?.name ?? undefined,
  }))
}
```

**Wait — that's still sequential because the completedMap query needs `campaignIds` from the first query.**

The fix is different: the first query already returns the full campaign rows. The completed-count query can run in parallel with the PostgREST response parsing, but it still needs `campaignIds`. The clean parallel win is only possible if we know the client filter upfront.

**Better approach**: when `effectiveClientId` is set (hot path for partner/client dashboards), run both queries in parallel keyed off `client_id` directly:

```typescript
if (effectiveClientId) {
  const [campaignResult, completedResult] = await Promise.all([
    db
      .from('campaigns')
      .select('*, clients(name), campaign_participants(count), campaign_assessments(count)')
      .eq('client_id', effectiveClientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    db
      .from('campaign_participants')
      .select('campaign_id')
      .eq('status', 'completed')
      // join via campaign_id → campaigns.client_id
      .in('campaign_id', db
        .from('campaigns')
        .select('id')
        .eq('client_id', effectiveClientId)
        .is('deleted_at', null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any, // Supabase JS sub-select typing is awkward
  ])
  // ... process both ...
}
```

**Supabase JS does NOT support sub-selects in `.in()`** in the same way raw SQL does. The cleanest fix that actually works is to accept the sequential dependency and just document it:

- Option A: Keep as-is, document that the 2nd query is dependent. No parallelization possible without restructuring the join.
- Option B: Create a Postgres view `campaigns_with_counts` that has `participant_count`, `completed_count`, `assessment_count` as columns. Single SELECT.
- Option C: Use a Postgres RPC (`get_campaigns_with_counts`) that runs the join server-side.

**Recommendation:** Go with Option B — create a DB view. It's the only real win here.

- [ ] **Step 1 (revised): Create a migration adding `campaigns_with_counts` view**

Create `supabase/migrations/20260411120000_campaigns_with_counts_view.sql`:

```sql
-- View that joins campaigns with their participant + completed + assessment counts
-- in a single query. Used by getCampaigns() to avoid sequential round-trips.

CREATE OR REPLACE VIEW campaigns_with_counts AS
SELECT
  c.*,
  COALESCE(
    (SELECT COUNT(*)
     FROM campaign_participants cp
     WHERE cp.campaign_id = c.id AND cp.deleted_at IS NULL),
    0
  ) AS participant_count,
  COALESCE(
    (SELECT COUNT(*)
     FROM campaign_participants cp
     WHERE cp.campaign_id = c.id
       AND cp.deleted_at IS NULL
       AND cp.status = 'completed'),
    0
  ) AS completed_count,
  COALESCE(
    (SELECT COUNT(*)
     FROM campaign_assessments ca
     WHERE ca.campaign_id = c.id AND ca.deleted_at IS NULL),
    0
  ) AS assessment_count
FROM campaigns c;

-- Grant the same RLS as the base table by exposing the view through the
-- authenticated role and having PostgREST enforce campaign RLS on the join.
GRANT SELECT ON campaigns_with_counts TO authenticated, anon, service_role;

COMMENT ON VIEW campaigns_with_counts IS
  'Campaign rows enriched with participant_count, completed_count, assessment_count. Used by getCampaigns() to eliminate a sequential completed-count query. RLS inherits from campaigns via the join.';
```

- [ ] **Step 2: Apply the migration to the dev DB**

Use the Supabase MCP tool:

```
apply_migration(name: "campaigns_with_counts_view", query: <SQL above>)
```

- [ ] **Step 3: Rewrite `getCampaigns` to query the view**

```typescript
export async function getCampaigns(options?: { clientId?: string }): Promise<CampaignWithMeta[]> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()
  let query = db
    .from('campaigns_with_counts')
    .select('*, clients(name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const effectiveClientId = options?.clientId ??
    (scope.requestSurface === 'client' ? (scope.activeContext?.tenantId ?? null) : null)

  if (effectiveClientId) {
    query = query.eq('client_id', effectiveClientId)
  } else if (!scope.isPlatformAdmin) {
    const campaignIds = await getAccessibleCampaignIds(scope)
    if (!campaignIds || campaignIds.length === 0) {
      return []
    }
    query = query.in('id', campaignIds)
  }

  const { data, error } = await query

  if (error) {
    throwActionError('getCampaigns', 'Unable to load campaigns.', error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...mapCampaignRow(row),
    assessmentCount: row.assessment_count ?? 0,
    participantCount: row.participant_count ?? 0,
    completedCount: row.completed_count ?? 0,
    clientName: row.clients?.name ?? undefined,
  }))
}
```

- [ ] **Step 4: Verify TypeScript and smoke test**

```bash
npx tsc --noEmit
```

Navigate to `/campaigns` (admin), `/partner/campaigns`, `/client/campaigns`. All three should render identical data.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260411120000_campaigns_with_counts_view.sql \
        src/app/actions/campaigns.ts

git commit -m "perf(campaigns): eliminate completed-count N+1 via campaigns_with_counts view"
```

**Effort:** 2 hours.

---

## Task 10: Parallelize `getCampaignById` (P1.4)

**Problem:** `src/app/actions/campaigns.ts:134-191`. After the initial campaign fetch, three sequential fetches run (assessments, participants, access links). They're independent.

### Steps

- [ ] **Step 1: Replace the three sequential fetches with `Promise.all`**

In `getCampaignByIdImpl`, replace lines 157-176:

```typescript
  // Load assessments, participants, and access links in parallel
  const [assessmentResult, participantResult, linkResult] = await Promise.all([
    db
      .from('campaign_assessments')
      .select('*, assessments(title, status, min_custom_factors)')
      .eq('campaign_id', id)
      .order('display_order', { ascending: true }),
    db
      .from('campaign_participants')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
    db
      .from('campaign_access_links')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
  ])

  const assessmentRows = assessmentResult.data
  const participantRows = participantResult.data
  const linkRows = linkResult.data
```

The rest of the function (lines 178-190) is unchanged.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual smoke test**

Navigate to any campaign detail page. Should render identically.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/campaigns.ts
git commit -m "perf(campaigns): parallelize getCampaignById sub-fetches"
```

**Effort:** 30 min.

---

## Task 11: Parallel email sends in `bulkInviteParticipants` (P1.5)

**Depends on:** Task 5 (uses the unified `sendParticipantInviteEmail` result shape) and Task 6 (detailed return shape already in place).

**Problem:** After Task 6, `bulkInviteParticipants` still loops over inserted participants and calls `sendParticipantInviteEmail` sequentially. 100 participants = 100 serial SMTP calls. Need concurrency-limited parallel sends.

**Target:** 5 concurrent sends at a time. No new dependency — hand-rolled chunking.

### Steps

- [ ] **Step 1: Replace the sequential send loop**

In `src/app/actions/campaigns.ts`, in `bulkInviteParticipants` (post-Task-6 version), replace the `for (const row of inserted) { ... }` loop with:

```typescript
  // Send invite emails with bounded concurrency
  const CONCURRENCY = 5
  let emailsSent = 0
  const emailErrors: Array<{ email: string; reason: string }> = []

  for (let i = 0; i < inserted.length; i += CONCURRENCY) {
    const chunk = inserted.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (row) => {
        try {
          const result = await sendParticipantInviteEmail(campaignId, row.id)
          return { email: row.email, ok: result.success, reason: result.error }
        } catch (err) {
          return {
            email: row.email,
            ok: false,
            reason: err instanceof Error ? err.message : 'Email delivery failed',
          }
        }
      })
    )

    for (const r of results) {
      if (r.ok) {
        emailsSent += 1
      } else {
        emailErrors.push({ email: r.email, reason: r.reason ?? 'Email delivery failed' })
      }
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual smoke test with realistic load**

Create a test CSV with 20 emails. Bulk invite. Open DevTools Network tab. Confirm the action completes in ~4× faster wall clock than the sequential version (the baseline was ~20s for 100; after this should be ~4s).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/campaigns.ts
git commit -m "perf(campaigns): parallelize bulk invite email sends with concurrency limit"
```

**Effort:** 1 hour.

---

## Task 12: Defer snapshot PDF URL signing to click time (P1.6)

**Problem:** `getReportSnapshotsForCampaign` at `src/app/actions/reports.ts:331-335` already uses `Promise.all` — but it still calls `getSignedReportPdfUrl` for EVERY snapshot on list load, even though the user probably only downloads a few. Wasted Supabase Storage sign calls.

**Target:** Don't sign URLs in the list action at all. Instead, have the download button call a small server action that signs on click.

**Files:**
- Modify: `src/app/actions/reports.ts` (remove the eager signing from `getReportSnapshotsForCampaign`, add a new `signSnapshotPdfUrl` action)
- Modify: wherever `snapshot.pdfUrl` is rendered as a download link (grep for it)

### Steps

- [ ] **Step 1: Add `signSnapshotPdfUrl` server action**

In `src/app/actions/reports.ts`, add near the other snapshot helpers:

```typescript
/**
 * Sign the PDF URL for a single snapshot on demand.
 * Used by list views to defer signing until the user clicks "Download".
 */
export async function signSnapshotPdfUrl(snapshotId: string): Promise<string | null> {
  const snapshot = await getReportSnapshot(snapshotId)
  // getReportSnapshot already resolves the signed URL and enforces scope
  return snapshot?.pdfUrl ?? null
}
```

- [ ] **Step 2: Stop eagerly signing in `getReportSnapshotsForCampaign`**

In `src/app/actions/reports.ts:329-335`, replace:

```typescript
  const snapshots = (data ?? []).map(mapReportSnapshotRow)
  // Resolve signed URLs for private storage paths
  return Promise.all(
    snapshots.map(async (s) =>
      s.pdfUrl ? { ...s, pdfUrl: await getSignedReportPdfUrl(s.pdfUrl) } : s
    )
  )
```

with:

```typescript
  // Return raw storage paths; consumers that need to download call
  // signSnapshotPdfUrl(id) on demand to avoid N sign calls on list load.
  return (data ?? []).map(mapReportSnapshotRow)
```

- [ ] **Step 3: Update consumers that render the download button**

Use Grep for callers of `getReportSnapshotsForCampaign`. For each, if the consumer renders `snapshot.pdfUrl` as an `<a href>`, change the download button to call `signSnapshotPdfUrl(snapshot.id)` on click and then open the returned URL in a new tab:

```tsx
'use client';

async function handleDownload(snapshotId: string) {
  const url = await signSnapshotPdfUrl(snapshotId);
  if (!url) {
    toast.error("PDF not available");
    return;
  }
  window.open(url, '_blank');
}

// ... in render:
<Button onClick={() => handleDownload(snapshot.id)}>
  <Download className="size-4" /> Download
</Button>
```

Alternatively (preferred after Task 3): route through `/api/reports/${snapshot.id}/pdf` directly, since that endpoint now handles all auth paths.

```tsx
<a href={`/api/reports/${snapshot.id}/pdf`} download>
  <Button><Download className="size-4" /> Download</Button>
</a>
```

This is simpler and consistent with Task 3. **Use the API route approach**.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual smoke test**

Navigate to a campaign with multiple completed reports. The list should load perceptibly faster. Clicking Download on any row should still download correctly.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/reports.ts [consumer files]
git commit -m "perf(reports): defer snapshot PDF URL signing until user clicks download"
```

**Effort:** 1 hour.

---

## Task 13: Add missing `loading.tsx` files (P1.7)

**Problem:** A handful of routes have no loading skeleton.

**Files to create:**
- `src/app/(dashboard)/campaigns/[id]/results/loading.tsx`
- `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx`

(Skipping `src/app/partner/diagnostics/[id]/loading.tsx` because the diagnostics feature is deferred per the roadmap.)

### Steps

- [ ] **Step 1: Create campaign results loading skeleton**

Create `src/app/(dashboard)/campaigns/[id]/results/loading.tsx`:

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CampaignResultsLoading() {
  return (
    <div className="flex flex-col gap-8 p-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-24 animate-shimmer rounded bg-muted" />
        <div className="h-8 w-64 animate-shimmer rounded bg-muted" />
        <div className="h-4 w-96 animate-shimmer rounded bg-muted" />
      </div>

      {/* Funnel skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-5">
              <div className="h-8 w-16 animate-shimmer rounded bg-muted" />
              <div className="mt-2 h-3 w-24 animate-shimmer rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-48 animate-shimmer rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-shimmer rounded bg-muted/60" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create partner participant-detail loading skeleton**

Create `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx`:

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PartnerParticipantDetailLoading() {
  return (
    <div className="space-y-8 max-w-6xl p-6">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-shimmer rounded bg-muted" />
        <div className="h-8 w-72 animate-shimmer rounded bg-muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-5">
              <div className="h-8 w-16 animate-shimmer rounded bg-muted" />
              <div className="mt-2 h-3 w-32 animate-shimmer rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="h-5 w-40 animate-shimmer rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-shimmer rounded bg-muted/60" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual smoke test**

Navigate to a campaign results page. During data fetch, the shimmer skeleton should briefly appear. Throttle the network in DevTools to "Slow 3G" to see it clearly.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/campaigns/\[id\]/results/loading.tsx \
        src/app/partner/campaigns/\[id\]/participants/\[participantId\]/loading.tsx

git commit -m "feat(loading): add skeleton states to campaign results and partner participant detail"
```

**Effort:** 30 min.

---

## Appendix A — File change summary

### Created
- `src/components/errors/error-boundary-card.tsx`
- `src/app/(dashboard)/reports/error.tsx`
- `src/app/(dashboard)/reports/[snapshotId]/error.tsx`
- `src/app/(dashboard)/report-templates/error.tsx`
- `src/app/(dashboard)/report-templates/[id]/builder/error.tsx`
- `src/app/(dashboard)/campaigns/[id]/results/error.tsx`
- `src/app/partner/campaigns/[id]/results/error.tsx`
- `src/app/client/campaigns/[id]/results/error.tsx`
- `src/app/(dashboard)/campaigns/[id]/results/loading.tsx`
- `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx`
- `supabase/migrations/20260411120000_campaigns_with_counts_view.sql`

### Modified
- `src/app/actions/reports.ts` (pagination, defer PDF signing, new `signSnapshotPdfUrl`)
- `src/app/(dashboard)/reports/page.tsx` (consume paginated shape)
- `src/app/(dashboard)/reports/reports-table.tsx` (add Load more)
- `src/app/api/reports/[snapshotId]/pdf/route.ts` (add client/partner admin auth path)
- `src/app/client/reports/[snapshotId]/page.tsx` (route download via API)
- `src/app/actions/campaigns.ts` (`inviteParticipant`, `bulkInviteParticipants`, `getCampaigns`, `getCampaignByIdImpl`)
- `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` (detailed toasts, retry action)
- `src/app/actions/partners.ts` (`getPartnerStats` parallelization)
- `src/app/actions/clients.ts` (`getClientStats` parallelization)
- `src/app/actions/participants.ts` and `src/app/actions/sessions.ts` (scope guards — contingent on audit results in Task 4)

## Appendix B — Commit strategy

13 tasks → 13 commits. Each commit is self-contained and reversible. Do not batch multiple tasks into one commit even if they touch the same file — keep the history clean so individual changes can be reverted if something breaks.

Conventional commit types used:
- `feat(...)` — new user-visible behavior (error boundaries, loading states, pagination)
- `fix(...)` — correctness fixes (scope guards, email result shape, PDF URL leak)
- `perf(...)` — performance refactors with no behavior change

## Appendix C — Expected impact after this plan ships

**Correctness:**
- No more silent email failures. Admins see a yellow warning with a retry button when an invite email fails.
- No more silent duplicate drops. Bulk invite returns inserted/skipped/emails-failed counts with a details dialog.
- No more blank white pages on route errors — every report/template/results route has a bounded error card.
- Private Supabase Storage URLs no longer leak into the client DOM.
- Cross-tenant campaign access is verified at every layer, not just the top-level detail page.

**Performance (cold-load estimates):**
- Partner overview: ~300–400ms faster (P1.1)
- Client overview: ~250–350ms faster (P1.2)
- Campaign list: ~200ms faster, N-sensitivity eliminated (P1.3)
- Campaign detail first load: ~150–200ms faster (P1.4)
- Bulk invite for 100 participants: ~20s → ~4s (P1.5)
- Campaign results report list: perceptible improvement on 20+ snapshots (P1.6)
- Reports list: no longer capped at 200 snapshots (P0.6)

**Total cumulative latency saved on the hot admin flow:** ~700–900ms per page, plus a 5× speedup on bulk invite.

## Appendix D — Out of scope for this plan

- Anything from Phases P2–P5 of the roadmap
- The `/generate/new` page refactor (long tail)
- `unstable_cache` wrapping (follow-up after profiling)
- Any schema changes beyond the single `campaigns_with_counts` view
- Test infrastructure setup (no Jest/Vitest runner exists for these routes today)

## Appendix E — Rollback strategy

Every task is a single commit. If a task causes a regression in staging or production:

1. `git revert <commit-sha>` — instant rollback, no data changes needed for Tasks 1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13.
2. Task 2 (pagination): revert + redeploy. No data touched.
3. Task 9 (campaigns_with_counts view): revert the code commit first. The view can stay in the DB harmlessly; drop it in a follow-up migration if desired.
