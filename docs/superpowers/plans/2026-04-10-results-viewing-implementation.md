# Results Viewing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build session-first results viewing across admin, partner, and client portals — new session detail pages, refactored participant detail pages, campaign results hub, on-demand report generation, and user-local timestamps.

**Architecture:** One set of shared view components in `src/components/results/` used by thin per-surface route files. Data fetching centralised in `src/app/actions/sessions.ts` (new) and additions to `src/app/actions/reports.ts`. Authorization via existing `requireSessionAccess` helper. No database schema changes beyond dropping one trigger.

**Tech Stack:** Next.js App Router, TanStack React Table via `DataTable`, Supabase, Tailwind, lucide-react, sonner toasts.

**Key reference files (read before starting any task):**
- Spec: `docs/superpowers/specs/2026-04-10-results-viewing-design.md`
- Admin dashboard (premium pattern): `src/app/(dashboard)/dashboard/page.tsx`
- DataTable component: `src/components/data-table/data-table.tsx`
- Admin participants table: `src/app/(dashboard)/participants/participants-table.tsx`
- Current admin participant detail: `src/app/(dashboard)/participants/[id]/page.tsx`
- Current admin campaign results: `src/app/(dashboard)/campaigns/[id]/results/page.tsx`
- Current partner participant detail: `src/app/partner/campaigns/[id]/participants/[participantId]/page.tsx`
- Server actions — participants: `src/app/actions/participants.ts`
- Server actions — reports: `src/app/actions/reports.ts`
- Server actions — assess (contains auto-gen call site): `src/app/actions/assess.ts:801`
- Auth helper: look in `src/lib/auth/authorization.ts` or `src/lib/auth/session-access.ts` for `requireSessionAccess`
- Database types: `src/types/database.ts` (CampaignParticipant, ParticipantSession, ParticipantScore, ParticipantResponse, ReportSnapshot, ReportTemplate)
- CLAUDE.md — UI/UX standards (TiltCard, ScrollReveal, icon glow, typography, loading shimmers, toast feedback)

**Branch:** `feat/partner-portal-polish` (current — continue on this branch)

---

## File structure overview

**New shared components:**
- `src/components/local-time.tsx` — client component for user-local date/time formatting
- `src/components/results/session-detail-view.tsx` — session detail body (header + stats + Scores/Responses/Reports tabs)
- `src/components/results/session-scores-panel.tsx` — Scores tab content
- `src/components/results/session-responses-panel.tsx` — Responses tab content (admin only)
- `src/components/results/session-reports-panel.tsx` — Reports tab content with polling
- `src/components/results/participant-detail-view.tsx` — participant detail body (header + Overview/Activity/Sessions/Reports tabs)
- `src/components/results/participant-overview-panel.tsx` — Overview tab content
- `src/components/results/participant-activity-panel.tsx` — Activity tab content
- `src/components/results/participant-sessions-panel.tsx` — Sessions tab content (table)
- `src/components/results/participant-reports-panel.tsx` — Reports tab content (rolled up)
- `src/components/results/campaign-results-hub.tsx` — campaign results hub with participant/session toggle
- `src/components/results/results-by-participant-table.tsx` — DataTable for "by participant" view
- `src/components/results/results-by-session-table.tsx` — DataTable for "by session" view
- `src/components/results/generate-report-dialog.tsx` — modal for picking template + audience + narrative mode

**New server actions:**
- `src/app/actions/sessions.ts` — new file: `getSessionDetail`, `getSessionSnapshots`
- `src/app/actions/reports.ts` — add `generateReportSnapshot`

**New routes:**
- `src/app/(dashboard)/participants/[id]/sessions/[sid]/page.tsx` + `loading.tsx`
- `src/app/partner/campaigns/[id]/results/page.tsx` + `loading.tsx`
- `src/app/partner/campaigns/[id]/participants/[participantId]/sessions/[sid]/page.tsx` + `loading.tsx`
- `src/app/client/campaigns/[id]/participants/[pid]/page.tsx` + `loading.tsx`
- `src/app/client/campaigns/[id]/participants/[pid]/sessions/[sid]/page.tsx` + `loading.tsx`

**Routes rewritten:**
- `src/app/(dashboard)/campaigns/[id]/results/page.tsx` — replace current content with campaign results hub
- `src/app/(dashboard)/participants/[id]/page.tsx` — use shared `participant-detail-view`
- `src/app/partner/campaigns/[id]/participants/[participantId]/page.tsx` — use shared view
- `src/app/client/campaigns/[id]/results/page.tsx` — use shared hub

**Routes modified:**
- `src/app/partner/campaigns/[id]/page.tsx` — add Results link to header actions
- `src/app/actions/assess.ts:801` — remove `triggerReportGeneration(sessionId)` call

**New migration:**
- `supabase/migrations/00XXX_disable_auto_snapshot_trigger.sql` — drop `on_session_completed_create_snapshots` trigger

---

## Task 1: Drop auto-snapshot DB trigger + remove call site

**Files:**
- Create: `supabase/migrations/00XXX_disable_auto_snapshot_trigger.sql` (use next available migration number)
- Modify: `src/app/actions/assess.ts` (remove the `triggerReportGeneration(sessionId)` call at line 801)

- [ ] **Step 1: Check next migration number**

Run: `ls supabase/migrations/ | tail -5`

Use the next number after the highest existing. Refer to it as `NNNNN` below.

- [ ] **Step 2: Create the migration file**

```sql
-- Disable auto-generation of report snapshots on session completion.
-- Reports are now generated on demand via the UI.
-- The function is kept in place in case the trigger needs to be re-enabled
-- in the future (e.g., for a lead generation flow).

DROP TRIGGER IF EXISTS on_session_completed_create_snapshots ON participant_sessions;
```

- [ ] **Step 3: Remove the call site in assess.ts**

Edit `src/app/actions/assess.ts` — find and remove these lines (around line 799-801):

```typescript
  // Trigger report generation for any pending snapshots created by DB trigger.
  // Fire-and-forget — don't block the participant response.
  triggerReportGeneration(sessionId)
```

Keep the `triggerReportGeneration` function definition itself (lines 813+) — it may be reused by `generateReportSnapshot` in a later task. Or leave it alone and just remove the call.

- [ ] **Step 4: Apply the migration via Supabase MCP**

Use the Supabase MCP tool to apply the migration:
```
mcp__claude_ai_Supabase__apply_migration with project_id=rwpfwfcaxoevnvtkdmkx, name=disable_auto_snapshot_trigger, query=<the SQL above>
```

- [ ] **Step 5: Verify no type or build errors**

Run: `npm run build 2>&1 | grep -iE "(error|Error|✓ Compiled)" | head -10`
Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ src/app/actions/assess.ts
git commit -m "feat(reports): remove auto-generation of report snapshots

- Drop on_session_completed_create_snapshots DB trigger
- Remove triggerReportGeneration call from assess.ts
- Reports are now generated on demand via the UI

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: LocalTime client component

**Files:**
- Create: `src/components/local-time.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";

type LocalTimeFormat = "date" | "date-time" | "date-time-full" | "relative";

interface LocalTimeProps {
  iso?: string | null;
  format?: LocalTimeFormat;
  fallback?: string;
  className?: string;
}

function formatValue(iso: string, format: LocalTimeFormat): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";

  if (format === "relative") {
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  if (format === "date") {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  if (format === "date-time") {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  // date-time-full
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LocalTime({
  iso,
  format = "date-time",
  fallback = "—",
  className,
}: LocalTimeProps) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (iso) {
      setText(formatValue(iso, format));
    } else {
      setText(null);
    }
  }, [iso, format]);

  if (!iso) {
    return <span className={className}>{fallback}</span>;
  }

  // Server renders the ISO string (stable); client replaces with formatted.
  // suppressHydrationWarning because the formatted output uses the user's timezone.
  return (
    <span className={className} suppressHydrationWarning>
      {text ?? iso}
    </span>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/components/local-time.tsx
git commit -m "feat(ui): add LocalTime component for user-local timestamps

Client-side component that formats ISO dates in the user's browser
timezone using en-AU locale. Supports date, date-time, date-time-full,
and relative format modes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Session actions (getSessionDetail, getSessionSnapshots)

**Files:**
- Create: `src/app/actions/sessions.ts`

**Context for implementer:**
- Read `src/app/actions/participants.ts` to see how `getParticipantSessions` builds session rows with scores. Reuse the same query patterns.
- Read `src/app/actions/reports.ts` to see how `getReportSnapshotsForParticipant` queries snapshots. Use a similar filter but by `participant_session_id`.
- For authorization, look for `requireSessionAccess` — it may be in `src/lib/auth/authorization.ts` or a similar path. Grep: `grep -r "requireSessionAccess" src/lib/`
- If `requireSessionAccess` does not exist as a dedicated helper, use `resolveAuthorizedScope` and manually verify the session belongs to a campaign the user can access (join through `campaign_participants → campaigns → clients`).

- [ ] **Step 1: Find auth helper**

Run: `grep -rn "requireSessionAccess\|canAccessSession" src/lib/ src/app/actions/`

If a helper exists, use it. Otherwise, write a local helper in `sessions.ts` that does:
1. Load the session row
2. Get its `campaign_participant_id` → `campaign_id` → `client_id`
3. Call `resolveAuthorizedScope()` and check `scope.clientIds.includes(clientId)` or `scope.isPlatformAdmin`
4. Throw `AuthorizationError` if not allowed

- [ ] **Step 2: Create the file with `getSessionDetail`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveAuthorizedScope, AuthorizationError } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import type { Assessment, ParticipantSession, ParticipantScore } from '@/types/database'

export type SessionDetailScore = {
  factorId: string
  factorName: string
  rawScore: number
  scaledScore: number
  percentile?: number
  confidenceLower?: number
  confidenceUpper?: number
  scoringMethod: string
  itemsUsed: number
}

export type SessionDetailSnapshot = {
  id: string
  templateId: string
  templateName?: string
  audienceType: string
  status: string
  generatedAt?: string
  releasedAt?: string
  errorMessage?: string
  pdfUrl?: string
  narrativeMode: string
}

export type SessionDetail = {
  id: string
  assessmentId: string
  assessmentTitle: string
  campaignId: string
  campaignTitle: string
  clientId?: string
  clientName?: string
  participantId: string
  participantName: string
  participantEmail: string
  status: string
  startedAt?: string
  completedAt?: string
  durationMinutes?: number
  responseCount: number
  scores: SessionDetailScore[]
  snapshots: SessionDetailSnapshot[]
  attemptNumber: number
  totalAttempts: number
}

async function assertSessionAccess(sessionId: string): Promise<string> {
  const scope = await resolveAuthorizedScope()
  if (scope.isPlatformAdmin || scope.isLocalDevelopmentBypass) return sessionId

  const db = await createClient()
  const { data, error } = await db
    .from('participant_sessions')
    .select('id, campaign_participants(campaigns(client_id))')
    .eq('id', sessionId)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Session not found or not accessible.')
  }

  const cp = (data as any).campaign_participants
  const campaign = Array.isArray(cp) ? cp[0]?.campaigns : cp?.campaigns
  const clientId = (Array.isArray(campaign) ? campaign[0]?.client_id : campaign?.client_id) as string | undefined

  if (!clientId || !scope.clientIds.includes(clientId)) {
    throw new AuthorizationError('Session not accessible in current scope.')
  }

  return sessionId
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  await assertSessionAccess(sessionId)
  const db = await createClient()

  const { data: session, error } = await db
    .from('participant_sessions')
    .select(`
      id,
      assessment_id,
      status,
      started_at,
      completed_at,
      campaign_participant_id,
      assessments(title),
      campaign_participants(
        id,
        email,
        first_name,
        last_name,
        campaign_id,
        campaigns(title, client_id, clients(name))
      ),
      participant_scores(
        id,
        factor_id,
        raw_score,
        scaled_score,
        percentile,
        confidence_lower,
        confidence_upper,
        scoring_method,
        items_used,
        factors(name)
      )
    `)
    .eq('id', sessionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throwActionError('getSessionDetail', 'Unable to load session.', error)
  }
  if (!session) return null

  const cp = (session as any).campaign_participants
  const cpRecord = Array.isArray(cp) ? cp[0] : cp
  const campaignRecord = Array.isArray(cpRecord?.campaigns) ? cpRecord.campaigns[0] : cpRecord?.campaigns
  const clientRecord = Array.isArray(campaignRecord?.clients) ? campaignRecord.clients[0] : campaignRecord?.clients
  const assessmentRecord = Array.isArray((session as any).assessments)
    ? (session as any).assessments[0]
    : (session as any).assessments

  // Count item responses for this session
  const { count: responseCount } = await db
    .from('participant_responses')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  // Attempt ordinal: rank this session among all sessions for same participant + assessment, ordered by started_at
  const { data: attemptSessions } = await db
    .from('participant_sessions')
    .select('id, started_at')
    .eq('campaign_participant_id', cpRecord?.id)
    .eq('assessment_id', (session as any).assessment_id)
    .order('started_at', { ascending: true, nullsFirst: false })

  const attemptRows = attemptSessions ?? []
  const attemptNumber = attemptRows.findIndex((r: any) => r.id === sessionId) + 1 || 1
  const totalAttempts = attemptRows.length || 1

  // Snapshots for this session
  const { data: snapshotRows } = await db
    .from('report_snapshots')
    .select('id, template_id, audience_type, status, generated_at, released_at, error_message, pdf_url, narrative_mode, report_templates(name)')
    .eq('participant_session_id', sessionId)
    .order('created_at', { ascending: false })

  const scores: SessionDetailScore[] = (((session as any).participant_scores ?? []) as any[]).map((s) => {
    const factor = Array.isArray(s.factors) ? s.factors[0] : s.factors
    return {
      factorId: String(s.factor_id),
      factorName: String(factor?.name ?? 'Unknown'),
      rawScore: Number(s.raw_score ?? 0),
      scaledScore: Number(s.scaled_score ?? 0),
      percentile: s.percentile != null ? Number(s.percentile) : undefined,
      confidenceLower: s.confidence_lower != null ? Number(s.confidence_lower) : undefined,
      confidenceUpper: s.confidence_upper != null ? Number(s.confidence_upper) : undefined,
      scoringMethod: String(s.scoring_method ?? 'ctt'),
      itemsUsed: Number(s.items_used ?? 0),
    }
  })

  const snapshots: SessionDetailSnapshot[] = ((snapshotRows ?? []) as any[]).map((r) => {
    const tpl = Array.isArray(r.report_templates) ? r.report_templates[0] : r.report_templates
    return {
      id: String(r.id),
      templateId: String(r.template_id),
      templateName: tpl?.name ? String(tpl.name) : undefined,
      audienceType: String(r.audience_type),
      status: String(r.status),
      generatedAt: r.generated_at ?? undefined,
      releasedAt: r.released_at ?? undefined,
      errorMessage: r.error_message ?? undefined,
      pdfUrl: r.pdf_url ?? undefined,
      narrativeMode: String(r.narrative_mode ?? 'derived'),
    }
  })

  const startedAt = (session as any).started_at ?? undefined
  const completedAt = (session as any).completed_at ?? undefined
  const durationMinutes = (startedAt && completedAt)
    ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000))
    : undefined

  const firstName = cpRecord?.first_name ?? ''
  const lastName = cpRecord?.last_name ?? ''
  const participantName = `${firstName} ${lastName}`.trim() || (cpRecord?.email ?? 'Unknown')

  return {
    id: String((session as any).id),
    assessmentId: String((session as any).assessment_id),
    assessmentTitle: String(assessmentRecord?.title ?? 'Unknown'),
    campaignId: String(campaignRecord?.id ?? cpRecord?.campaign_id ?? ''),
    campaignTitle: String(campaignRecord?.title ?? ''),
    clientId: clientRecord?.id ? String(clientRecord.id) : undefined,
    clientName: clientRecord?.name ? String(clientRecord.name) : undefined,
    participantId: String(cpRecord?.id ?? ''),
    participantName,
    participantEmail: String(cpRecord?.email ?? ''),
    status: String((session as any).status),
    startedAt,
    completedAt,
    durationMinutes,
    responseCount: responseCount ?? 0,
    scores,
    snapshots,
    attemptNumber,
    totalAttempts,
  }
}

export async function getSessionSnapshots(sessionId: string): Promise<SessionDetailSnapshot[]> {
  await assertSessionAccess(sessionId)
  const db = await createClient()

  const { data, error } = await db
    .from('report_snapshots')
    .select('id, template_id, audience_type, status, generated_at, released_at, error_message, pdf_url, narrative_mode, report_templates(name)')
    .eq('participant_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError('getSessionSnapshots', 'Unable to load snapshots.', error)
  }

  return ((data ?? []) as any[]).map((r) => {
    const tpl = Array.isArray(r.report_templates) ? r.report_templates[0] : r.report_templates
    return {
      id: String(r.id),
      templateId: String(r.template_id),
      templateName: tpl?.name ? String(tpl.name) : undefined,
      audienceType: String(r.audience_type),
      status: String(r.status),
      generatedAt: r.generated_at ?? undefined,
      releasedAt: r.released_at ?? undefined,
      errorMessage: r.error_message ?? undefined,
      pdfUrl: r.pdf_url ?? undefined,
      narrativeMode: String(r.narrative_mode ?? 'derived'),
    }
  })
}
```

- [ ] **Step 3: Verify types compile**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10`

If type errors appear (likely — the `any` casts are working around Supabase join types), adjust until it compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/sessions.ts
git commit -m "feat(actions): add sessions.ts with getSessionDetail and getSessionSnapshots

New file for session-scoped read actions. Returns session metadata,
scores, snapshots, and attempt ordinal. Includes authorization guard
using resolveAuthorizedScope + client membership check.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: generateReportSnapshot action

**Files:**
- Modify: `src/app/actions/reports.ts` (add new export)

**Context:**
- Read existing `queueSnapshotsForSession` and `retrySnapshot` in `reports.ts` to see the `/api/reports/generate` call pattern.
- The action creates a new row in `report_snapshots`, then POSTs to `/api/reports/generate` with the `snapshotId` to kick the runner.

- [ ] **Step 1: Add the new action**

Append to `src/app/actions/reports.ts` (before the last export or at the end of the file):

```typescript
export async function generateReportSnapshot(input: {
  sessionId: string
  templateId: string
  audienceType: 'participant' | 'hr_manager' | 'consultant'
  narrativeMode?: 'ai_enhanced' | 'derived'
}): Promise<{ success: true; snapshotId: string } | { error: string }> {
  const { sessionId, templateId, audienceType, narrativeMode = 'derived' } = input

  // Authorization: reuse the session access helper from sessions.ts
  // (import it here). If that helper is not exported, do the same scope check.
  try {
    const scope = await resolveAuthorizedScope()
    if (!scope.isPlatformAdmin && !scope.isLocalDevelopmentBypass) {
      const db = await createClient()
      const { data: sessionRow } = await db
        .from('participant_sessions')
        .select('id, campaign_participants(campaigns(client_id))')
        .eq('id', sessionId)
        .single()

      const cp = (sessionRow as any)?.campaign_participants
      const campaign = Array.isArray(cp) ? cp[0]?.campaigns : cp?.campaigns
      const clientId = (Array.isArray(campaign) ? campaign[0]?.client_id : campaign?.client_id) as string | undefined

      if (!clientId || !scope.clientIds.includes(clientId)) {
        return { error: 'Not authorized to generate reports for this session.' }
      }
    }
  } catch (err) {
    logActionError('generateReportSnapshot.auth', err)
    return { error: 'Authorization check failed.' }
  }

  const adminDb = createAdminClient()

  // Look up the session's campaign_id for the snapshot row
  const { data: sessionData, error: sessionErr } = await adminDb
    .from('participant_sessions')
    .select('id, campaign_participants(campaign_id)')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !sessionData) {
    logActionError('generateReportSnapshot.session', sessionErr)
    return { error: 'Session not found.' }
  }

  const cp = (sessionData as any).campaign_participants
  const campaignId = (Array.isArray(cp) ? cp[0]?.campaign_id : cp?.campaign_id) as string | undefined

  if (!campaignId) {
    return { error: 'Session is not linked to a campaign.' }
  }

  const { data: snapshotRow, error: insertErr } = await adminDb
    .from('report_snapshots')
    .insert({
      campaign_id: campaignId,
      participant_session_id: sessionId,
      template_id: templateId,
      audience_type: audienceType,
      narrative_mode: narrativeMode,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !snapshotRow) {
    logActionError('generateReportSnapshot.insert', insertErr)
    return { error: 'Failed to create snapshot.' }
  }

  // Kick the runner
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
      },
      body: JSON.stringify({ snapshotId: snapshotRow.id }),
    })
  } catch (fetchErr) {
    logActionError('generateReportSnapshot.fetch', fetchErr)
    // Don't fail the action — the row exists, can be retried manually
  }

  revalidatePath('/participants')

  return { success: true, snapshotId: String(snapshotRow.id) }
}
```

Imports needed at top of file (if not already present):
- `resolveAuthorizedScope` from `@/lib/auth/authorization`
- `createClient` from `@/lib/supabase/server`
- `createAdminClient` from `@/lib/supabase/admin`
- `logActionError` from `@/lib/security/action-errors`
- `revalidatePath` from `next/cache`

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/reports.ts
git commit -m "feat(reports): add generateReportSnapshot action for on-demand generation

Creates a pending snapshot row and invokes /api/reports/generate with
the internal key. Authorized via client membership check. Returns
snapshot id on success.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: GenerateReportDialog component

**Files:**
- Create: `src/components/results/generate-report-dialog.tsx`

**Context:**
- Read existing Dialog component usage in `src/app/(dashboard)/campaigns/` or `src/components/ui/confirm-dialog.tsx`
- The dialog needs to fetch report templates. Use existing action if present (grep: `grep -rn "getReportTemplates\|report_templates" src/app/actions/`), otherwise create a simple inline fetch in the server parent or accept templates as a prop.

- [ ] **Step 1: Find templates server action**

Run: `grep -rn "getReportTemplates\|listReportTemplates\|fetchReportTemplates" src/app/actions/`

If nothing exists, add this action to `src/app/actions/reports.ts`:

```typescript
export type ReportTemplateOption = {
  id: string
  name: string
  description?: string
}

export async function getActiveReportTemplates(): Promise<ReportTemplateOption[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('report_templates')
    .select('id, name, description')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    throwActionError('getActiveReportTemplates', 'Unable to load templates.', error)
  }

  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : undefined,
  }))
}
```

Commit this separately if you add it:
```bash
git add src/app/actions/reports.ts
git commit -m "feat(reports): add getActiveReportTemplates for dialog picker"
```

- [ ] **Step 2: Create the dialog component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateReportSnapshot } from "@/app/actions/reports";

export type GenerateReportDialogTemplate = {
  id: string;
  name: string;
  description?: string;
};

interface GenerateReportDialogProps {
  sessionId: string;
  templates: GenerateReportDialogTemplate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AudienceType = "participant" | "hr_manager" | "consultant";
type NarrativeMode = "derived" | "ai_enhanced";

export function GenerateReportDialog({
  sessionId,
  templates,
  open,
  onOpenChange,
}: GenerateReportDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState<string>("");
  const [audienceType, setAudienceType] = useState<AudienceType>("participant");
  const [narrativeMode, setNarrativeMode] = useState<NarrativeMode>("derived");

  function handleSubmit() {
    if (!templateId) {
      toast.error("Please choose a template");
      return;
    }

    startTransition(async () => {
      const result = await generateReportSnapshot({
        sessionId,
        templateId,
        audienceType,
        narrativeMode,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Report generation queued");
      onOpenChange(false);
      router.refresh();
      setTemplateId("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate report</DialogTitle>
          <DialogDescription>
            Pick a template and audience. The report will appear in the Reports tab once generated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Audience</Label>
            <Select
              value={audienceType}
              onValueChange={(v) => setAudienceType(v as AudienceType)}
            >
              <SelectTrigger id="audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">Participant</SelectItem>
                <SelectItem value="hr_manager">HR Manager</SelectItem>
                <SelectItem value="consultant">Consultant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="narrative">Narrative mode</Label>
            <Select
              value={narrativeMode}
              onValueChange={(v) => setNarrativeMode(v as NarrativeMode)}
            >
              <SelectTrigger id="narrative">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="derived">Derived (template defaults)</SelectItem>
                <SelectItem value="ai_enhanced">AI-enhanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !templateId}>
            {isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/results/generate-report-dialog.tsx src/app/actions/reports.ts
git commit -m "feat(results): add GenerateReportDialog with template/audience/narrative picker"
```

---

## Task 6: Session panels — Scores, Responses, Reports

**Files:**
- Create: `src/components/results/session-scores-panel.tsx`
- Create: `src/components/results/session-responses-panel.tsx`
- Create: `src/components/results/session-reports-panel.tsx`

**Context:**
- Read the current Scores tab in `src/app/(dashboard)/participants/[id]/page.tsx` (around line 351-419) for the existing horizontal bar pattern.
- Read the current Responses tab in the same file (around line 423-517) for the section grouping pattern.
- The Responses panel takes data from `getParticipantResponses(sessionId)` — already exists.

- [ ] **Step 1: Create SessionScoresPanel**

Create `src/components/results/session-scores-panel.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { BarChart3 } from "lucide-react";
import type { SessionDetailScore } from "@/app/actions/sessions";

interface SessionScoresPanelProps {
  scores: SessionDetailScore[];
}

export function SessionScoresPanel({ scores }: SessionScoresPanelProps) {
  if (scores.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No scores yet"
        description="Scores will appear here when this session is completed and scored."
      />
    );
  }

  const sorted = [...scores].sort((a, b) => b.scaledScore - a.scaledScore);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sorted.map((score) => {
        const pct = Math.max(0, Math.min(100, score.scaledScore));
        return (
          <Card key={score.factorId}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{score.factorName}</CardTitle>
                <Badge variant="outline" className="uppercase text-xs">
                  {score.scoringMethod}
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground">
                {score.itemsUsed} item{score.itemsUsed !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-bold tabular-nums">
                  {Math.round(score.scaledScore)}
                </span>
                {score.percentile != null && (
                  <Badge variant="secondary">
                    {Math.round(score.percentile)}th percentile
                  </Badge>
                )}
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {score.confidenceLower != null && score.confidenceUpper != null && (
                <p className="text-caption text-muted-foreground mt-2">
                  CI: {Math.round(score.confidenceLower)}–{Math.round(score.confidenceUpper)}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create SessionResponsesPanel**

First read the existing responses tab for the data shape. Then create `src/components/results/session-responses-panel.tsx`:

```tsx
import { getParticipantResponses } from "@/app/actions/participants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { MessageSquare } from "lucide-react";

interface SessionResponsesPanelProps {
  sessionId: string;
}

export async function SessionResponsesPanel({ sessionId }: SessionResponsesPanelProps) {
  const groups = await getParticipantResponses(sessionId);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No responses yet"
        description="Item responses will appear here once the session is in progress."
      />
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.sectionId}>
          <CardHeader>
            <CardTitle className="text-base">{group.sectionTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-start justify-between gap-4 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="text-sm flex-1">{item.stem}</p>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {item.responseValue ?? "—"}
                    </p>
                    {item.responseTimeMs != null && (
                      <p className="text-caption text-muted-foreground">
                        {(item.responseTimeMs / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

Note: This is a server component (async). It fetches inside the component. Parent passes `sessionId`.

- [ ] **Step 3: Create SessionReportsPanel**

This is the tricky one — it polls. Create `src/components/results/session-reports-panel.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { FileText, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getSessionSnapshots, type SessionDetailSnapshot } from "@/app/actions/sessions";
import { releaseSnapshot, retrySnapshot } from "@/app/actions/reports";
import { LocalTime } from "@/components/local-time";

interface SessionReportsPanelProps {
  sessionId: string;
  initialSnapshots: SessionDetailSnapshot[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  generating: "secondary",
  ready: "default",
  released: "default",
  failed: "destructive",
};

function statusLabel(s: string): string {
  if (s === "pending") return "Pending";
  if (s === "generating") return "Generating";
  if (s === "ready") return "Ready";
  if (s === "released") return "Released";
  if (s === "failed") return "Failed";
  return s;
}

function audienceLabel(a: string): string {
  if (a === "participant") return "Participant";
  if (a === "hr_manager") return "HR Manager";
  if (a === "consultant") return "Consultant";
  return a;
}

export function SessionReportsPanel({
  sessionId,
  initialSnapshots,
}: SessionReportsPanelProps) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const next = await getSessionSnapshots(sessionId);
      setSnapshots(next);
    } catch (err) {
      toast.error("Failed to refresh snapshots");
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId]);

  // Poll while anything is pending or generating
  useEffect(() => {
    const hasActive = snapshots.some(
      (s) => s.status === "pending" || s.status === "generating"
    );
    if (!hasActive) return;

    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [snapshots, refresh]);

  function handleRelease(id: string) {
    startTransition(async () => {
      try {
        await releaseSnapshot(id);
        toast.success("Report released");
        await refresh();
      } catch (err) {
        toast.error("Failed to release report");
      }
    });
  }

  function handleRetry(id: string) {
    startTransition(async () => {
      try {
        await retrySnapshot(id);
        toast.success("Retrying report generation");
        await refresh();
      } catch (err) {
        toast.error("Failed to retry");
      }
    });
  }

  if (snapshots.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No reports generated yet"
        description="Use the Generate Report button above to create a report for this session."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {snapshots.map((snapshot) => (
        <Card key={snapshot.id}>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">
                  {snapshot.templateName ?? "Template"}
                </p>
                <Badge variant="outline" className="text-xs">
                  {audienceLabel(snapshot.audienceType)}
                </Badge>
                <Badge variant={STATUS_VARIANT[snapshot.status] ?? "outline"}>
                  {statusLabel(snapshot.status)}
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                {snapshot.generatedAt ? (
                  <>
                    Generated <LocalTime iso={snapshot.generatedAt} format="relative" />
                  </>
                ) : (
                  "Queued"
                )}
                {snapshot.errorMessage && (
                  <span className="text-destructive ml-2">
                    · {snapshot.errorMessage}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(snapshot.status === "ready" || snapshot.status === "released") && (
                <Link
                  href={`/reports/${snapshot.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Preview
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
              {snapshot.status === "ready" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRelease(snapshot.id)}
                >
                  Release
                </Button>
              )}
              {snapshot.status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry(snapshot.id)}
                >
                  Retry
                </Button>
              )}
              {snapshot.pdfUrl && (snapshot.status === "ready" || snapshot.status === "released") && (
                <Link
                  href={`/api/reports/${snapshot.id}/pdf`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  PDF
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10`

The `getParticipantResponses` return shape may not match what SessionResponsesPanel expects — check the existing type and adjust field names (`stem` vs `itemStem`, etc.) as needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/session-scores-panel.tsx src/components/results/session-responses-panel.tsx src/components/results/session-reports-panel.tsx
git commit -m "feat(results): add session scores/responses/reports panels

- Scores panel: factor bars with percentiles and confidence
- Responses panel: admin-only, grouped by section
- Reports panel: client-side with 3s polling while pending/generating"
```

---

## Task 7: SessionDetailView shared component

**Files:**
- Create: `src/components/results/session-detail-view.tsx`

- [ ] **Step 1: Create the view**

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalTime } from "@/components/local-time";
import { SessionScoresPanel } from "./session-scores-panel";
import { SessionResponsesPanel } from "./session-responses-panel";
import { SessionReportsPanel } from "./session-reports-panel";
import { GenerateReportTrigger } from "./generate-report-trigger";
import type { SessionDetail } from "@/app/actions/sessions";
import type { GenerateReportDialogTemplate } from "./generate-report-dialog";

interface SessionDetailViewProps {
  session: SessionDetail;
  templates: GenerateReportDialogTemplate[];
  canSeeResponses: boolean;
  backHref: string;
  backLabel: string;
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "in_progress") return "secondary";
  if (status === "expired") return "destructive";
  return "outline";
}

export function SessionDetailView({
  session,
  templates,
  canSeeResponses,
  backHref,
  backLabel,
}: SessionDetailViewProps) {
  const durationLabel =
    session.durationMinutes != null
      ? session.durationMinutes < 60
        ? `${session.durationMinutes}m`
        : `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m`
      : "—";

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <PageHeader
        eyebrow={session.assessmentTitle}
        title={session.participantName}
        description={`${session.participantEmail} · ${session.campaignTitle}${
          session.clientName ? ` · ${session.clientName}` : ""
        }`}
      >
        <GenerateReportTrigger
          sessionId={session.id}
          templates={templates}
        />
      </PageHeader>

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Status</p>
            <div className="mt-2">
              <Badge variant={statusBadgeVariant(session.status)}>
                {session.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Duration</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{durationLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">Factors scored</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {session.scores.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-caption text-muted-foreground">
              {session.totalAttempts > 1 ? "Attempt" : "Responses"}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {session.totalAttempts > 1
                ? `${session.attemptNumber}/${session.totalAttempts}`
                : session.responseCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metadata row */}
      <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
        <p>
          Started: <LocalTime iso={session.startedAt} format="date-time" />
        </p>
        <p>
          Completed: <LocalTime iso={session.completedAt} format="date-time" />
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          {canSeeResponses && <TabsTrigger value="responses">Responses</TabsTrigger>}
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-4">
          <SessionScoresPanel scores={session.scores} />
        </TabsContent>

        {canSeeResponses && (
          <TabsContent value="responses" className="mt-4">
            <SessionResponsesPanel sessionId={session.id} />
          </TabsContent>
        )}

        <TabsContent value="reports" className="mt-4">
          <SessionReportsPanel
            sessionId={session.id}
            initialSnapshots={session.snapshots}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Create GenerateReportTrigger client component**

Create `src/components/results/generate-report-trigger.tsx`:

```tsx
"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GenerateReportDialog,
  type GenerateReportDialogTemplate,
} from "./generate-report-dialog";

interface GenerateReportTriggerProps {
  sessionId: string;
  templates: GenerateReportDialogTemplate[];
}

export function GenerateReportTrigger({
  sessionId,
  templates,
}: GenerateReportTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FileText className="size-4" />
        Generate Report
      </Button>
      <GenerateReportDialog
        sessionId={sessionId}
        templates={templates}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/components/results/session-detail-view.tsx src/components/results/generate-report-trigger.tsx
git commit -m "feat(results): add SessionDetailView shared component"
```

---

## Task 8: Admin session detail route

**Files:**
- Create: `src/app/(dashboard)/participants/[id]/sessions/[sid]/page.tsx`
- Create: `src/app/(dashboard)/participants/[id]/sessions/[sid]/loading.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id: participantId, sid: sessionId } = await params;

  const [session, templates] = await Promise.all([
    getSessionDetail(sessionId),
    getActiveReportTemplates(),
  ]);

  if (!session || session.participantId !== participantId) {
    notFound();
  }

  return (
    <SessionDetailView
      session={session}
      templates={templates}
      canSeeResponses={true}
      backHref={`/participants/${participantId}`}
      backLabel="Back to participant"
    />
  );
}
```

- [ ] **Step 2: Create loading.tsx**

```tsx
export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-8 w-72 rounded bg-muted" />
        <div className="h-4 w-96 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
```

- [ ] **Step 3: Verify build and test in dev**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled|/participants/\[id\]/sessions)" | head -10`

Expected: compiled OK, new route appears in manifest.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/participants/\[id\]/sessions/
git commit -m "feat(admin): add session detail route under participant"
```

---

## Task 9: Participant panels — Overview, Activity, Sessions, Reports

**Files:**
- Create: `src/components/results/participant-overview-panel.tsx`
- Create: `src/components/results/participant-activity-panel.tsx`
- Create: `src/components/results/participant-sessions-panel.tsx`
- Create: `src/components/results/participant-reports-panel.tsx`

**Context:**
- Read `src/app/(dashboard)/participants/[id]/page.tsx` lines 195-517 for the existing panels we're replacing.
- Read `src/app/actions/participants.ts` for `getParticipantSessions`, `getParticipantActivity`, and `getReportSnapshotsForParticipant` return types.
- The activity panel's event types may include: `invited`, `started`, `session_started`, `session_completed`, `completed`. Preserve this.

- [ ] **Step 1: Create ParticipantOverviewPanel**

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight, ClipboardList, CheckCircle2, Clock, Mail } from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { LocalTime } from "@/components/local-time";
import type { ParticipantDetail } from "@/app/actions/participants";
import type { ParticipantSession } from "@/app/actions/participants";

interface ParticipantOverviewPanelProps {
  participant: ParticipantDetail;
  sessions: ParticipantSession[];
  sessionBaseHref: string; // e.g., "/participants/[id]/sessions" or "/partner/campaigns/[id]/participants/[pid]/sessions"
}

export function ParticipantOverviewPanel({
  participant,
  sessions,
  sessionBaseHref,
}: ParticipantOverviewPanelProps) {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "completed").length;
  const totalTime =
    participant.startedAt && participant.completedAt
      ? formatDuration(participant.startedAt, participant.completedAt)
      : null;

  const stats = [
    {
      key: "total",
      label: "Sessions",
      value: totalSessions,
      description: `${completedSessions} completed`,
      icon: ClipboardList,
      bgClass: "bg-primary/10",
      iconClass: "text-primary",
    },
    {
      key: "completed",
      label: "Completed",
      value: completedSessions,
      description: `of ${totalSessions}`,
      icon: CheckCircle2,
      bgClass: "bg-brand/10",
      iconClass: "text-brand",
    },
    {
      key: "time",
      label: "Total time",
      value: totalTime ?? "—",
      description: totalTime ? "From start to completion" : "Not completed",
      icon: Clock,
      bgClass: "bg-accent",
      iconClass: "text-accent-foreground",
    },
  ];

  const recent = [...sessions]
    .filter((s) => s.startedAt)
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))[0];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <ScrollReveal key={stat.key} delay={index * 60}>
            <TiltCard>
              <Card variant="interactive">
                <CardContent className="flex items-start justify-between gap-4 py-5">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
                    <p className="text-caption text-muted-foreground mt-1">
                      {stat.label}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${stat.bgClass}`}
                  >
                    <stat.icon className={`size-5 ${stat.iconClass}`} />
                  </div>
                </CardContent>
              </Card>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Identity card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              <span className="text-foreground">{participant.email}</span>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Campaign</p>
              <p className="font-medium">{participant.campaignTitle}</p>
            </div>
            {participant.clientName && (
              <div>
                <p className="text-caption text-muted-foreground">Client</p>
                <p className="font-medium">{participant.clientName}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <p className="text-caption text-muted-foreground">Invited</p>
                <p className="font-medium">
                  <LocalTime iso={participant.invitedAt} format="date" />
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Completed</p>
                <p className="font-medium">
                  <LocalTime iso={participant.completedAt} format="date" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Most recent session */}
        {recent && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Most recent session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{recent.assessmentTitle}</p>
                <Badge variant="outline" className="mt-1">
                  {recent.status}
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground">
                Started <LocalTime iso={recent.startedAt} format="relative" />
              </p>
              <Link
                href={`${sessionBaseHref}/${recent.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View session
                <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function formatDuration(start: string, end: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
```

- [ ] **Step 2: Create ParticipantActivityPanel**

```tsx
import { Activity, Mail, Play, CheckCircle2 } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { ScrollReveal } from "@/components/scroll-reveal";
import type { ActivityEvent } from "@/app/actions/participants";
import { EmptyState } from "@/components/empty-state";

interface ParticipantActivityPanelProps {
  activity: ActivityEvent[];
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  invited: Mail,
  started: Play,
  session_started: Play,
  session_completed: CheckCircle2,
  completed: CheckCircle2,
};

const EVENT_DOT_CLASSES: Record<string, string> = {
  invited: "bg-muted-foreground/50",
  started: "bg-primary",
  session_started: "bg-brand",
  session_completed: "bg-primary",
  completed: "bg-emerald-500",
};

export function ParticipantActivityPanel({
  activity,
}: ParticipantActivityPanelProps) {
  if (activity.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Events will appear here as the participant progresses."
      />
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {activity.map((event, index) => {
          const Icon = EVENT_ICONS[event.type] ?? Activity;
          const dotClass = EVENT_DOT_CLASSES[event.type] ?? "bg-muted-foreground/50";
          return (
            <ScrollReveal key={`${event.type}-${event.timestamp}-${index}`} delay={index * 40}>
              <div className="relative flex items-start gap-4 pl-0">
                <div
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${dotClass}`}
                >
                  <Icon className="size-4 text-white" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="font-medium text-sm">{event.label}</p>
                  <p className="text-caption text-muted-foreground">
                    <LocalTime iso={event.timestamp} format="date-time" />
                    {event.detail && ` · ${event.detail}`}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ParticipantSessionsPanel**

```tsx
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ClipboardList } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import type { ParticipantSession } from "@/app/actions/participants";

interface ParticipantSessionsPanelProps {
  sessions: ParticipantSession[];
  sessionBaseHref: string;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "in_progress") return "secondary";
  if (status === "expired") return "destructive";
  return "outline";
}

function computeAttempts(sessions: ParticipantSession[]): Map<string, number> {
  // Rank sessions per assessment by startedAt to derive attempt ordinals
  const byAssessment = new Map<string, ParticipantSession[]>();
  for (const s of sessions) {
    const list = byAssessment.get(s.assessmentId) ?? [];
    list.push(s);
    byAssessment.set(s.assessmentId, list);
  }
  const attempts = new Map<string, number>();
  for (const list of byAssessment.values()) {
    list
      .slice()
      .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
      .forEach((s, idx) => attempts.set(s.id, idx + 1));
  }
  return attempts;
}

export function ParticipantSessionsPanel({
  sessions,
  sessionBaseHref,
}: ParticipantSessionsPanelProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No sessions yet"
        description="Assessment sessions will appear here once the participant starts."
      />
    );
  }

  const attempts = computeAttempts(sessions);

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Attempt</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Scores</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <Link
                  href={`${sessionBaseHref}/${session.id}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {session.assessmentTitle}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">
                #{attempts.get(session.id) ?? 1}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(session.status)}>
                  {session.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <LocalTime iso={session.startedAt} format="date-time" />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <LocalTime iso={session.completedAt} format="date-time" />
              </TableCell>
              <TableCell className="tabular-nums">
                {session.scores?.length ?? 0}
              </TableCell>
              <TableCell>
                <Link
                  href={`${sessionBaseHref}/${session.id}`}
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Create ParticipantReportsPanel**

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { FileText, ExternalLink } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import type { ReportSnapshot } from "@/types/database";

// ReportSnapshot may have optional templateName when joined with report_templates;
// accept a superset type here.
type SnapshotWithTemplate = ReportSnapshot & { templateName?: string };

interface ParticipantReportsPanelProps {
  snapshots: SnapshotWithTemplate[];
  sessionBaseHref: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  generating: "secondary",
  ready: "default",
  released: "default",
  failed: "destructive",
};

function audienceLabel(a: string): string {
  if (a === "participant") return "Participant";
  if (a === "hr_manager") return "HR Manager";
  if (a === "consultant") return "Consultant";
  return a;
}

export function ParticipantReportsPanel({
  snapshots,
  sessionBaseHref,
}: ParticipantReportsPanelProps) {
  if (snapshots.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No reports yet"
        description="Reports will appear here once generated from any session."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshots.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">
                {s.templateName ?? "Template"}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{audienceLabel(s.audienceType)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>
                  {s.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                <LocalTime iso={s.generatedAt ?? undefined} format="relative" />
              </TableCell>
              <TableCell>
                {(s.status === "ready" || s.status === "released") && (
                  <Link
                    href={`/reports/${s.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Preview
                    <ExternalLink className="size-3.5" />
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10`

Fix any type mismatches against the actual `ParticipantSession`, `ActivityEvent`, `ReportSnapshotListItem`, `ParticipantDetail` types.

- [ ] **Step 6: Commit**

```bash
git add src/components/results/participant-overview-panel.tsx src/components/results/participant-activity-panel.tsx src/components/results/participant-sessions-panel.tsx src/components/results/participant-reports-panel.tsx
git commit -m "feat(results): add participant overview/activity/sessions/reports panels"
```

---

## Task 10: ParticipantDetailView shared component

**Files:**
- Create: `src/components/results/participant-detail-view.tsx`

- [ ] **Step 1: Create the view**

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParticipantOverviewPanel } from "./participant-overview-panel";
import { ParticipantActivityPanel } from "./participant-activity-panel";
import { ParticipantSessionsPanel } from "./participant-sessions-panel";
import { ParticipantReportsPanel } from "./participant-reports-panel";
import type { ParticipantDetail, ParticipantSession, ActivityEvent } from "@/app/actions/participants";
import type { ReportSnapshot } from "@/types/database";

type SnapshotWithTemplate = ReportSnapshot & { templateName?: string };

interface ParticipantDetailViewProps {
  participant: ParticipantDetail;
  sessions: ParticipantSession[];
  activity: ActivityEvent[];
  snapshots: SnapshotWithTemplate[];
  backHref: string;
  backLabel: string;
  sessionBaseHref: string;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "in_progress" || status === "registered") return "secondary";
  if (status === "withdrawn" || status === "expired") return "destructive";
  return "outline";
}

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function ParticipantDetailView({
  participant,
  sessions,
  activity,
  snapshots,
  backHref,
  backLabel,
  sessionBaseHref,
}: ParticipantDetailViewProps) {
  const displayName =
    `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim() ||
    participant.email;

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="flex items-start gap-4">
        <Avatar className="size-14">
          <AvatarFallback>{getInitials(displayName, participant.email)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <PageHeader
            eyebrow="Participant"
            title={displayName}
            description={`${participant.email}${
              participant.clientName ? ` · ${participant.clientName}` : ""
            } · ${participant.campaignTitle}`}
          >
            <Badge variant={statusVariant(participant.status)} className="uppercase">
              {participant.status}
            </Badge>
          </PageHeader>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ParticipantOverviewPanel
            participant={participant}
            sessions={sessions}
            sessionBaseHref={sessionBaseHref}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ParticipantActivityPanel activity={activity} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <ParticipantSessionsPanel
            sessions={sessions}
            sessionBaseHref={sessionBaseHref}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ParticipantReportsPanel
            snapshots={snapshots}
            sessionBaseHref={sessionBaseHref}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/components/results/participant-detail-view.tsx
git commit -m "feat(results): add ParticipantDetailView shared component"
```

---

## Task 11: Refactor admin participant detail page

**Files:**
- Modify: `src/app/(dashboard)/participants/[id]/page.tsx` (rewrite)
- Modify: `src/app/(dashboard)/participants/[id]/loading.tsx` (update skeleton to match new 4-tab layout)
- Optional: `src/app/actions/reports.ts` — update `getReportSnapshotsForParticipant` to join `report_templates(name)` and return the template name in each row. If not updated, the Reports tab will show "Template" as a fallback label for all rows, which is a minor UX regression but not a blocker.

- [ ] **Step 1: Rewrite the page**

```tsx
import { notFound } from "next/navigation";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { getReportSnapshotsForParticipant } from "@/app/actions/reports";
import { ParticipantDetailView } from "@/components/results/participant-detail-view";

export default async function AdminParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [participant, sessions, activity, snapshots] = await Promise.all([
    getParticipant(id),
    getParticipantSessions(id),
    getParticipantActivity(id),
    getReportSnapshotsForParticipant(id),
  ]);

  if (!participant) notFound();

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      backHref="/participants"
      backLabel="Back to participants"
      sessionBaseHref={`/participants/${id}/sessions`}
    />
  );
}
```

- [ ] **Step 2: Update existing loading.tsx**

The existing `src/app/(dashboard)/participants/[id]/loading.tsx` was written for the old 5-tab layout. Replace its content with a skeleton matching the new 4-tab layout (Overview/Activity/Sessions/Reports):

```tsx
export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="h-4 w-32 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      <div className="flex items-start gap-4">
        <div className="size-14 rounded-full bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
          <div className="h-8 w-72 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
          <div className="h-4 w-96 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        </div>
      </div>
      <div className="h-10 w-80 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent"
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build and test manually**

Run: `npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10`

Visit `/participants/[some-id]` in dev mode. Verify tabs render, session drill-in works.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/participants/\[id\]/page.tsx src/app/\(dashboard\)/participants/\[id\]/loading.tsx
git commit -m "refactor(admin): use ParticipantDetailView for participant detail page"
```

---

## Task 12: Partner session detail route

**Files:**
- Create: `src/app/partner/campaigns/[id]/participants/[participantId]/sessions/[sid]/page.tsx`
- Create: `src/app/partner/campaigns/[id]/participants/[participantId]/sessions/[sid]/loading.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function PartnerSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string; sid: string }>;
}) {
  const { id: campaignId, participantId, sid: sessionId } = await params;

  const [session, templates] = await Promise.all([
    getSessionDetail(sessionId),
    getActiveReportTemplates(),
  ]);

  if (!session || session.participantId !== participantId) notFound();

  return (
    <SessionDetailView
      session={session}
      templates={templates}
      canSeeResponses={false}
      backHref={`/partner/campaigns/${campaignId}/participants/${participantId}`}
      backLabel="Back to participant"
    />
  );
}
```

- [ ] **Step 2: Create loading.tsx**

Copy the same loading.tsx from Task 8.

- [ ] **Step 3: Verify and commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5
git add src/app/partner/campaigns/\[id\]/participants/\[participantId\]/sessions/
git commit -m "feat(partner): add session detail route"
```

---

## Task 13: Refactor partner participant detail route

**Files:**
- Modify: `src/app/partner/campaigns/[id]/participants/[participantId]/page.tsx` (rewrite)
- Modify: `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx` (update to match new 4-tab layout — reuse the skeleton from Task 11 Step 2)

- [ ] **Step 1: Rewrite**

```tsx
import { notFound } from "next/navigation";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { getReportSnapshotsForParticipant } from "@/app/actions/reports";
import { ParticipantDetailView } from "@/components/results/participant-detail-view";

export default async function PartnerParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const { id: campaignId, participantId } = await params;

  const [participant, sessions, activity, snapshots] = await Promise.all([
    getParticipant(participantId),
    getParticipantSessions(participantId),
    getParticipantActivity(participantId),
    getReportSnapshotsForParticipant(participantId),
  ]);

  if (!participant) notFound();

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      backHref={`/partner/campaigns/${campaignId}`}
      backLabel="Back to campaign"
      sessionBaseHref={`/partner/campaigns/${campaignId}/participants/${participantId}/sessions`}
    />
  );
}
```

- [ ] **Step 2: Update loading.tsx**

Replace the existing `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx` with the same skeleton from Task 11 Step 2 (4-tab layout with avatar header).

- [ ] **Step 3: Verify and commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10
git add src/app/partner/campaigns/\[id\]/participants/\[participantId\]/page.tsx src/app/partner/campaigns/\[id\]/participants/\[participantId\]/loading.tsx
git commit -m "refactor(partner): use ParticipantDetailView for participant detail"
```

---

## Task 14: Client participant detail route (new)

**Files:**
- Create: `src/app/client/campaigns/[id]/participants/[pid]/page.tsx`
- Create: `src/app/client/campaigns/[id]/participants/[pid]/loading.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { getReportSnapshotsForParticipant } from "@/app/actions/reports";
import { ParticipantDetailView } from "@/components/results/participant-detail-view";

export default async function ClientParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id: campaignId, pid } = await params;

  const [participant, sessions, activity, snapshots] = await Promise.all([
    getParticipant(pid),
    getParticipantSessions(pid),
    getParticipantActivity(pid),
    getReportSnapshotsForParticipant(pid),
  ]);

  if (!participant) notFound();

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      backHref={`/client/campaigns/${campaignId}`}
      backLabel="Back to campaign"
      sessionBaseHref={`/client/campaigns/${campaignId}/participants/${pid}/sessions`}
    />
  );
}
```

- [ ] **Step 2: Create loading.tsx**

Copy loading skeleton from Task 8.

- [ ] **Step 3: Commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5
git add src/app/client/campaigns/\[id\]/participants/\[pid\]/page.tsx src/app/client/campaigns/\[id\]/participants/\[pid\]/loading.tsx
git commit -m "feat(client): add participant detail route with shared view"
```

---

## Task 15: Client session detail route

**Files:**
- Create: `src/app/client/campaigns/[id]/participants/[pid]/sessions/[sid]/page.tsx`
- Create: `src/app/client/campaigns/[id]/participants/[pid]/sessions/[sid]/loading.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function ClientSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string; sid: string }>;
}) {
  const { id: campaignId, pid, sid: sessionId } = await params;

  const [session, templates] = await Promise.all([
    getSessionDetail(sessionId),
    getActiveReportTemplates(),
  ]);

  if (!session || session.participantId !== pid) notFound();

  return (
    <SessionDetailView
      session={session}
      templates={templates}
      canSeeResponses={false}
      backHref={`/client/campaigns/${campaignId}/participants/${pid}`}
      backLabel="Back to participant"
    />
  );
}
```

- [ ] **Step 2: Create loading.tsx** (copy from Task 8)

- [ ] **Step 3: Commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5
git add src/app/client/campaigns/\[id\]/participants/\[pid\]/sessions/
git commit -m "feat(client): add session detail route"
```

---

## Task 16: Campaign results hub — tables

**Files:**
- Create: `src/components/results/results-by-participant-table.tsx`
- Create: `src/components/results/results-by-session-table.tsx`

- [ ] **Step 1: Create ResultsByParticipantTable**

```tsx
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { LocalTime } from "@/components/local-time";
import type { ParticipantWithMeta } from "@/app/actions/participants";

type Row = ParticipantWithMeta & {
  displayName: string;
  lastActivityValue: string;
};

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

interface Props {
  participants: ParticipantWithMeta[];
  participantHref: (p: ParticipantWithMeta) => string;
}

export function ResultsByParticipantTable({ participants, participantHref }: Props) {
  const rows: Row[] = participants.map((p) => ({
    ...p,
    displayName:
      `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email,
    lastActivityValue: p.lastActivity ?? p.created_at ?? "",
  }));

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participant" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {getInitials(row.original.displayName, row.original.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <DataTableRowLink
              href={participantHref(row.original)}
              ariaLabel={`Open ${row.original.displayName}`}
              className="font-semibold text-foreground hover:text-primary"
            >
              {row.original.displayName}
            </DataTableRowLink>
            <p className="text-caption text-muted-foreground truncate">
              {row.original.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "sessions",
      header: "Sessions",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.completedSessionCount}/{row.original.sessionCount}
        </span>
      ),
    },
    {
      accessorKey: "lastActivityValue",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last activity" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.lastActivityValue} format="relative" />
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["displayName", "email"]}
      searchPlaceholder="Search participants"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Invited", value: "invited" },
            { label: "Registered", value: "registered" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Withdrawn", value: "withdrawn" },
            { label: "Expired", value: "expired" },
          ],
        },
      ]}
      defaultSort={{ id: "displayName", desc: false }}
      rowHref={(row) => participantHref(row)}
      pageSize={20}
    />
  );
}
```

- [ ] **Step 2: Create ResultsBySessionTable**

This needs session-level data. Add a new server action first in `src/app/actions/sessions.ts`:

```typescript
export type CampaignSessionRow = {
  id: string
  assessmentId: string
  assessmentTitle: string
  participantId: string
  participantName: string
  participantEmail: string
  status: string
  startedAt?: string
  completedAt?: string
  scoreCount: number
  attemptNumber: number
}

export async function getCampaignSessions(campaignId: string): Promise<CampaignSessionRow[]> {
  const scope = await resolveAuthorizedScope()

  const db = await createClient()
  const { data, error } = await db
    .from('participant_sessions')
    .select(`
      id,
      assessment_id,
      status,
      started_at,
      completed_at,
      campaign_participant_id,
      assessments(title),
      campaign_participants!inner(
        id,
        email,
        first_name,
        last_name,
        campaign_id,
        campaigns!inner(client_id)
      ),
      participant_scores(id)
    `)
    .eq('campaign_participants.campaign_id', campaignId)
    .order('started_at', { ascending: false, nullsFirst: false })

  if (error) {
    throwActionError('getCampaignSessions', 'Unable to load sessions.', error)
  }

  // Client scope check
  if (!scope.isPlatformAdmin && !scope.isLocalDevelopmentBypass) {
    const filtered = (data ?? []).filter((row: any) => {
      const cp = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants
      const campaign = Array.isArray(cp?.campaigns) ? cp.campaigns[0] : cp?.campaigns
      const clientId = campaign?.client_id
      return clientId && scope.clientIds.includes(clientId)
    })
    return mapRows(filtered)
  }

  return mapRows(data ?? [])
}

function mapRows(data: any[]): CampaignSessionRow[] {
  // Group by (participantId, assessmentId) to compute attempt ordinal
  const ordinalMap = new Map<string, number[]>()
  for (const row of data) {
    const cp = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants
    const key = `${cp?.id}:${row.assessment_id}`
    const list = ordinalMap.get(key) ?? []
    list.push(new Date(row.started_at ?? 0).getTime())
    ordinalMap.set(key, list)
  }
  // Sort each list ascending
  for (const list of ordinalMap.values()) list.sort((a, b) => a - b)

  return data.map((row) => {
    const cp = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants
    const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments
    const participantName =
      `${cp?.first_name ?? ""} ${cp?.last_name ?? ""}`.trim() || String(cp?.email ?? "")
    const key = `${cp?.id}:${row.assessment_id}`
    const list = ordinalMap.get(key) ?? []
    const ts = new Date(row.started_at ?? 0).getTime()
    const attemptNumber = list.indexOf(ts) + 1 || 1

    return {
      id: String(row.id),
      assessmentId: String(row.assessment_id),
      assessmentTitle: String(assessment?.title ?? "Unknown"),
      participantId: String(cp?.id ?? ""),
      participantName,
      participantEmail: String(cp?.email ?? ""),
      status: String(row.status),
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      scoreCount: Array.isArray(row.participant_scores) ? row.participant_scores.length : 0,
      attemptNumber,
    }
  })
}
```

- [ ] **Step 3: Create the table component**

`src/components/results/results-by-session-table.tsx`:

```tsx
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { LocalTime } from "@/components/local-time";
import type { CampaignSessionRow } from "@/app/actions/sessions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  not_started: "outline",
  in_progress: "secondary",
  completed: "default",
  expired: "destructive",
};

interface Props {
  sessions: CampaignSessionRow[];
  sessionHref: (s: CampaignSessionRow) => string;
  assessmentOptions: Array<{ label: string; value: string }>;
}

export function ResultsBySessionTable({ sessions, sessionHref, assessmentOptions }: Props) {
  const columns: ColumnDef<CampaignSessionRow>[] = [
    {
      accessorKey: "participantName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participant" />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <DataTableRowLink
            href={sessionHref(row.original)}
            ariaLabel={`Open session for ${row.original.participantName}`}
            className="font-semibold hover:text-primary"
          >
            {row.original.participantName}
          </DataTableRowLink>
          <p className="text-caption text-muted-foreground truncate">
            {row.original.participantEmail}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "assessmentTitle",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assessment" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.assessmentTitle}</span>
          <Badge variant="outline" className="text-xs tabular-nums">
            #{row.original.attemptNumber}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "startedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Started" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.startedAt} format="date-time" />
        </span>
      ),
    },
    {
      accessorKey: "completedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Completed" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.completedAt} format="date-time" />
        </span>
      ),
    },
    {
      accessorKey: "scoreCount",
      header: "Scores",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{row.original.scoreCount}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={sessions}
      searchableColumns={["participantName", "participantEmail", "assessmentTitle"]}
      searchPlaceholder="Search sessions"
      filterableColumns={[
        {
          id: "assessmentTitle",
          title: "Assessment",
          options: assessmentOptions,
        },
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Not Started", value: "not_started" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Expired", value: "expired" },
          ],
        },
      ]}
      defaultSort={{ id: "startedAt", desc: true }}
      rowHref={(row) => sessionHref(row)}
      pageSize={20}
    />
  );
}
```

- [ ] **Step 4: Verify build and commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10
git add src/components/results/results-by-participant-table.tsx src/components/results/results-by-session-table.tsx src/app/actions/sessions.ts
git commit -m "feat(results): add by-participant and by-session tables + getCampaignSessions"
```

---

## Task 17: CampaignResultsHub shared component

**Files:**
- Create: `src/components/results/campaign-results-hub.tsx`

- [ ] **Step 1: Create the hub**

```tsx
"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ResultsByParticipantTable } from "./results-by-participant-table";
import { ResultsBySessionTable } from "./results-by-session-table";
import type { ParticipantWithMeta } from "@/app/actions/participants";
import type { CampaignSessionRow } from "@/app/actions/sessions";

interface CampaignResultsHubProps {
  campaignTitle: string;
  participants: ParticipantWithMeta[];
  sessions: CampaignSessionRow[];
  participantHref: (p: ParticipantWithMeta) => string;
  sessionHref: (s: CampaignSessionRow) => string;
}

export function CampaignResultsHub({
  campaignTitle,
  participants,
  sessions,
  participantHref,
  sessionHref,
}: CampaignResultsHubProps) {
  const [view, setView] = useState<"participants" | "sessions">("participants");

  const invited = participants.length;
  const started = participants.filter(
    (p) => p.status === "in_progress" || p.status === "completed"
  ).length;
  const completed = participants.filter((p) => p.status === "completed").length;
  const pct = invited > 0 ? Math.round((completed / invited) * 100) : 0;

  // Build assessment options for the by-session filter.
  // The filter column is `assessmentTitle`, so both value and label must be
  // the title string for the faceted filter to match rows correctly.
  const assessmentOptions = Array.from(
    new Set(sessions.map((s) => s.assessmentTitle))
  ).map((title) => ({ value: title, label: title }));

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        eyebrow="Results"
        title={campaignTitle}
        description="Participant and session results for this campaign."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatBox label="Invited" value={invited} />
        <StatBox label="Started" value={started} />
        <StatBox label="Completed" value={completed} />
        <StatBox label="Completion rate" value={`${pct}%`} />
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setView("participants")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === "participants"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          By participant
        </button>
        <button
          type="button"
          onClick={() => setView("sessions")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === "sessions"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          By session
        </button>
      </div>

      {view === "participants" ? (
        <ResultsByParticipantTable
          participants={participants}
          participantHref={participantHref}
        />
      ) : (
        <ResultsBySessionTable
          sessions={sessions}
          sessionHref={sessionHref}
          assessmentOptions={assessmentOptions}
        />
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="py-4 px-5">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5
git add src/components/results/campaign-results-hub.tsx
git commit -m "feat(results): add CampaignResultsHub with participant/session toggle"
```

---

## Task 18: Rewrite admin campaign results page

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/results/page.tsx` (rewrite)
- Modify: `src/app/(dashboard)/campaigns/[id]/results/loading.tsx` (update existing if present, create if not) — skeleton should match new hub layout (stat strip + toggle + table)

- [ ] **Step 1: Rewrite**

```tsx
import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getParticipants } from "@/app/actions/participants";
import { getCampaignSessions } from "@/app/actions/sessions";
import { CampaignResultsHub } from "@/components/results/campaign-results-hub";

export default async function AdminCampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [{ data: participants }, sessions] = await Promise.all([
    getParticipants({ campaignId: id, perPage: 500 }),
    getCampaignSessions(id),
  ]);

  return (
    <CampaignResultsHub
      campaignTitle={campaign.title}
      participants={participants}
      sessions={sessions}
      participantHref={(p) => `/participants/${p.id}`}
      sessionHref={(s) => `/participants/${s.participantId}/sessions/${s.id}`}
    />
  );
}
```

- [ ] **Step 2: Update loading.tsx**

Check if `src/app/(dashboard)/campaigns/[id]/results/loading.tsx` exists. If it does, replace its content; if not, create it with:

```tsx
export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="h-8 w-80 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent"
          />
        ))}
      </div>
      <div className="h-10 w-60 rounded-lg bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      <div className="h-96 rounded-xl bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
    </div>
  );
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -10
git add src/app/\(dashboard\)/campaigns/\[id\]/results/
git commit -m "refactor(admin): rewrite campaign results page with new hub"
```

---

## Task 19: Partner campaign results route + header link

**Files:**
- Create: `src/app/partner/campaigns/[id]/results/page.tsx`
- Create: `src/app/partner/campaigns/[id]/results/loading.tsx`
- Modify: `src/app/partner/campaigns/[id]/page.tsx` (add Results link in header actions)

- [ ] **Step 1: Create results page**

```tsx
import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getParticipants } from "@/app/actions/participants";
import { getCampaignSessions } from "@/app/actions/sessions";
import { CampaignResultsHub } from "@/components/results/campaign-results-hub";

export default async function PartnerCampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [{ data: participants }, sessions] = await Promise.all([
    getParticipants({ campaignId: id, perPage: 500 }),
    getCampaignSessions(id),
  ]);

  return (
    <CampaignResultsHub
      campaignTitle={campaign.title}
      participants={participants}
      sessions={sessions}
      participantHref={(p) => `/partner/campaigns/${id}/participants/${p.id}`}
      sessionHref={(s) => `/partner/campaigns/${id}/participants/${s.participantId}/sessions/${s.id}`}
    />
  );
}
```

- [ ] **Step 2: Create loading.tsx**

```tsx
export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 w-60 rounded bg-muted" />
      <div className="h-96 rounded-xl bg-muted" />
    </div>
  );
}
```

- [ ] **Step 3: Add Results link to partner campaign detail header**

Find the header actions block in `src/app/partner/campaigns/[id]/page.tsx` (the PageHeader children). Add a Results link as a secondary action alongside "Back to campaigns" and "View participants":

```tsx
<Link
  href={`/partner/campaigns/${campaign.id}/results`}
  className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
>
  Results
</Link>
```

Place it in the `<div className="flex flex-wrap gap-3">` action container in the PageHeader children.

- [ ] **Step 4: Verify and commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5
git add src/app/partner/campaigns/\[id\]/results/ src/app/partner/campaigns/\[id\]/page.tsx
git commit -m "feat(partner): add campaign results route + header link"
```

---

## Task 20: Rewrite client campaign results page

**Files:**
- Modify: `src/app/client/campaigns/[id]/results/page.tsx` (rewrite)
- Create: `src/app/client/campaigns/[id]/results/loading.tsx`

- [ ] **Step 1: Rewrite page**

```tsx
import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getParticipants } from "@/app/actions/participants";
import { getCampaignSessions } from "@/app/actions/sessions";
import { CampaignResultsHub } from "@/components/results/campaign-results-hub";

export default async function ClientCampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [{ data: participants }, sessions] = await Promise.all([
    getParticipants({ campaignId: id, perPage: 500 }),
    getCampaignSessions(id),
  ]);

  return (
    <CampaignResultsHub
      campaignTitle={campaign.title}
      participants={participants}
      sessions={sessions}
      participantHref={(p) => `/client/campaigns/${id}/participants/${p.id}`}
      sessionHref={(s) => `/client/campaigns/${id}/participants/${s.participantId}/sessions/${s.id}`}
    />
  );
}
```

- [ ] **Step 2: Create loading.tsx** (same pattern as Task 19)

- [ ] **Step 3: Commit**

```bash
npm run build 2>&1 | grep -iE "(error|✓ Compiled)" | head -5
git add src/app/client/campaigns/\[id\]/results/
git commit -m "refactor(client): rewrite campaign results page with new hub"
```

---

## Task 21: Lightweight tests

**Files:**
- Create: `src/components/local-time.test.tsx` (if test infrastructure exists)
- Create: `src/app/actions/sessions.test.ts` (if test infrastructure exists)

**Note to implementer:** First check if the project has a test runner configured. Run:
```
cat package.json | grep -iE "(vitest|jest|test)" | head -10
```

If no test infrastructure exists, **skip this task entirely** and proceed to Task 22. The spec calls for light-touch tests but not at the cost of bootstrapping a test framework that doesn't exist. Note the skip in the commit for Task 22.

If vitest/jest is configured:

- [ ] **Step 1: LocalTime unit test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LocalTime } from "./local-time";

describe("LocalTime", () => {
  it("renders fallback when iso is null", () => {
    const { container } = render(<LocalTime iso={null} fallback="—" />);
    expect(container.textContent).toBe("—");
  });

  it("renders the iso string before hydration", () => {
    const iso = "2026-04-10T12:00:00Z";
    const { container } = render(<LocalTime iso={iso} format="date-time" />);
    // Before effect runs, server-equivalent output is the iso string
    expect(container.textContent?.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- local-time`
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add src/components/local-time.test.tsx
git commit -m "test(results): add LocalTime unit test"
```

---

## Task 22: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build 2>&1 | grep -iE "(error|Error|Warning|✓ Compiled|results|sessions)" | head -40`

Expected: `✓ Compiled successfully`, all results/session routes present, no errors.

- [ ] **Step 2: Route inventory**

Verify these routes exist in the build output:
- `/participants/[id]` (modified)
- `/participants/[id]/sessions/[sid]`
- `/campaigns/[id]/results` (modified)
- `/partner/campaigns/[id]/results`
- `/partner/campaigns/[id]/participants/[participantId]` (modified)
- `/partner/campaigns/[id]/participants/[participantId]/sessions/[sid]`
- `/client/campaigns/[id]/results` (modified)
- `/client/campaigns/[id]/participants/[pid]`
- `/client/campaigns/[id]/participants/[pid]/sessions/[sid]`

- [ ] **Step 3: Commit a wrap-up marker (optional)**

```bash
git log --oneline feat/partner-portal-polish --not main | head -25
```

No commit needed — the work is done across the prior commits.

---
