# Partner Portal Production Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the partner portal to production quality by removing developer scaffolding, adding proper DataTable-based listing pages, polishing the dashboard, and cleaning up navigation.

**Architecture:** The partner portal currently routes everything through a single catch-all `[[...slug]]/page.tsx` into a monolithic `workspace-portal-live.tsx` (1,900 lines). We will progressively extract each page into its own dedicated route file with proper client-component DataTable instances, matching the patterns established in the admin portal (`(dashboard)/participants/`, `(dashboard)/directory/`, etc.) and the client portal (`client/campaigns/`, `client/participants/`). The catch-all remains as a fallback for any unmatched routes.

**Tech Stack:** Next.js (App Router), TanStack React Table via `DataTable` component, Tailwind CSS, Supabase server actions, lucide-react icons.

**Key reference files (read these before starting any task):**
- Admin dashboard: `src/app/(dashboard)/dashboard/page.tsx` — premium stat cards pattern
- Admin participants table: `src/app/(dashboard)/participants/participants-table.tsx` — DataTable column pattern
- Admin directory table: `src/app/(dashboard)/directory/client-directory-table.tsx` — DataTable with faceted filters
- Data table components: `src/components/data-table/` — DataTable, DataTableColumnHeader, DataTableRowLink, DataTableActionsMenu
- Premium UI components: `src/components/scroll-reveal.tsx`, `src/components/tilt-card.tsx`, `src/components/animated-number.tsx`, `src/components/mini-bars.tsx`
- Page header: `src/components/page-header.tsx`
- Existing partner live page: `src/components/workspace-portal-live.tsx` — data fetching patterns to reuse
- Sidebar nav config: `src/components/app-sidebar.tsx` — partner nav section
- Portal config: `src/lib/workspace-portal-config.ts` — descriptions to clean up
- Existing client portal pages (for patterns): `src/app/client/campaigns/page.tsx`, `src/app/client/participants/page.tsx`
- CLAUDE.md — UI/UX standards (TiltCard, ScrollReveal, icon glow, typography hierarchy)

---

## Task 1: Navigation Cleanup

**Files:**
- Modify: `src/components/app-sidebar.tsx:129-158`

- [ ] **Step 1: Update partner nav**

Remove the "AI Tools" section entirely (Matching Results). Remove the "Diagnostics" section entirely (Sessions). Rename "Results" to "Participants" under Assessments and change its icon to `Users`. Update the href from `/results` to `/participants`.

The resulting `partnerNav` should be:
```typescript
const partnerNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: Home }],
  },
  {
    label: "Clients",
    items: [
      { title: "Clients", href: "/directory?tab=clients", icon: Building2 },
    ],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessments", href: "/assessments", icon: ClipboardList },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
];
```

- [ ] **Step 2: Verify the app compiles**

Run: `pnpm build --filter=. 2>&1 | tail -20` (or `pnpm dev` and check for errors)

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "fix(partner): strip diagnostics, AI tools, rename results to participants in nav"
```

---

## Task 2: Clean Up Portal Config Descriptions

**Files:**
- Modify: `src/lib/workspace-portal-config.ts:35-179`

- [ ] **Step 1: Rewrite partner portal page configs**

Replace all developer-note descriptions with production-ready copy. Remove sections/highlights (they render in the fallback `WorkspacePortalPage` which authenticated users won't see — but keep them clean in case). The key changes are to `title` and `description` fields which feed into `PageHeader`.

```typescript
export const partnerPortalPages: Record<string, WorkspacePortalPageConfig> = {
  "": {
    eyebrow: "Partner Portal",
    title: "Welcome to your partner workspace",
    description: "Manage clients, campaigns, and participant outcomes.",
    primaryAction: { label: "View clients", href: "/clients" },
    secondaryAction: { label: "Review campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Client operations",
        description: "Manage assigned clients and run campaign operations.",
        highlights: [
          "View and manage your assigned client portfolio.",
          "Deploy assessments into client-ready campaigns.",
          "Track participant progress and outcomes.",
        ],
      },
    ],
  },
  clients: {
    eyebrow: "Clients",
    title: "Client portfolio",
    description: "Manage your assigned client accounts.",
    primaryAction: { label: "Review campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Client portfolio",
        description: "View and manage clients assigned to your partner account.",
        highlights: [
          "Track client status, industry, and size.",
          "View campaign and diagnostic activity per client.",
          "Access client-scoped reporting.",
        ],
      },
    ],
  },
  assessments: {
    eyebrow: "Assessments",
    title: "Assessments",
    description: "Assessments deployed across your client campaigns.",
    primaryAction: { label: "View participants", href: "/participants" },
    sections: [
      {
        title: "Assessment library",
        description: "Browse assessments available for your client campaigns.",
        highlights: [
          "View assessment status and deployment counts.",
          "See which clients and campaigns use each assessment.",
          "Track participant completion rates.",
        ],
      },
    ],
  },
  campaigns: {
    eyebrow: "Campaigns",
    title: "Campaigns",
    description: "Assessment campaigns across your client portfolio.",
    primaryAction: { label: "View clients", href: "/clients" },
    secondaryAction: { label: "View participants", href: "/participants" },
    sections: [
      {
        title: "Campaign management",
        description: "Monitor and manage assessment campaigns for your clients.",
        highlights: [
          "Track campaign status and participant progress.",
          "View assessment lineups per campaign.",
          "Access participant reports and exports.",
        ],
      },
    ],
  },
  participants: {
    eyebrow: "Participants",
    title: "Participants",
    description: "All participants across your campaigns.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Participant tracking",
        description: "Monitor participant progress across all campaigns.",
        highlights: [
          "View participant status and completion progress.",
          "Access individual participant reports.",
          "Export participant data.",
        ],
      },
    ],
  },
  diagnostics: {
    eyebrow: "Diagnostics",
    title: "Diagnostic sessions",
    description: "Run diagnostic sessions for your assigned clients.",
    sections: [
      {
        title: "Diagnostic sessions",
        description: "View and manage diagnostic sessions.",
        highlights: [
          "Track session status and respondent progress.",
          "View results for completed sessions.",
        ],
      },
    ],
  },
  results: {
    eyebrow: "Results",
    title: "Results and reporting",
    description: "Campaign and participant outcomes across your client portfolio.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Reporting",
        description: "Access campaign results and participant reports.",
        highlights: [
          "View completed campaign outcomes.",
          "Launch participant reports.",
          "Export reports for offline use.",
        ],
      },
    ],
  },
  matching: {
    eyebrow: "Matching",
    title: "Matching results",
    description: "AI matching recommendations for your clients.",
    sections: [
      {
        title: "Matching outputs",
        description: "Review published matching recommendations.",
        highlights: [
          "View matching run status and results.",
          "See top factor recommendations per session.",
        ],
      },
    ],
  },
};
```

- [ ] **Step 2: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/workspace-portal-config.ts
git commit -m "fix(partner): replace developer notes with production copy in portal config"
```

---

## Task 3: Production Dashboard

**Files:**
- Create: `src/app/partner/dashboard/page.tsx`
- Create: `src/app/partner/dashboard/loading.tsx`
- Modify: `src/app/partner/[[...slug]]/page.tsx` (redirect root to dashboard)

- [ ] **Step 1: Create partner dashboard page**

Create `src/app/partner/dashboard/page.tsx`. This replaces the `WorkspaceOverview` from workspace-portal-live.tsx. Follow the admin dashboard pattern exactly: time-based greeting, `ScrollReveal`/`TiltCard`/`AnimatedNumber`/`MiniBars` stat cards, quick actions grid.

The data fetching reuses existing server actions: `getClients()`, `getCampaigns()`, `getDiagnosticSessions()` (already imported in workspace-portal-live.tsx — check those imports for the correct action paths).

Stat cards for partner dashboard:
1. **Clients** — `clients.length` — icon: `Building2` — href: `/partner/clients`
2. **Campaigns** — `campaigns.length` — icon: `Megaphone` — href: `/partner/campaigns`
3. **Participants** — sum of `campaign.participantCount` — icon: `Users` — href: `/partner/participants`
4. **Completed** — sum of `campaign.completedCount` — icon: `CheckCircle2` — href: `/partner/participants`

Use `bg-muted` / `text-muted-foreground` / `bg-muted-foreground/30` for all stat cards (partner portal doesn't have taxonomy colours).

Quick actions for partner dashboard:
1. **View Clients** — href: `/partner/clients` — icon: `Building2` — "Browse your client portfolio"
2. **Review Campaigns** — href: `/partner/campaigns` — icon: `Megaphone` — "Monitor campaign progress"
3. **View Participants** — href: `/partner/participants` — icon: `Users` — "Track participant outcomes"
4. **View Assessments** — href: `/partner/assessments` — icon: `ClipboardList` — "Browse deployed assessments"

Below the stat cards and quick actions, add a "Recent campaigns" card showing the 5 most recent campaigns (similar to the current dashboard's "Recent campaign activity" section but cleaned up — no developer notes in descriptions). Each row: campaign title (as Link to `/partner/campaigns/{id}`), client name, status badge, participant count, completed count. Wrap in a `Card` with `CardHeader` title "Recent campaigns".

- [ ] **Step 2: Create loading skeleton**

Create `src/app/partner/dashboard/loading.tsx` matching the layout structure with shimmer skeletons. Follow the admin's loading pattern with `DataTableLoading` or simple shimmer divs matching the stat card grid (4 cards) + quick actions grid (4 cards) + recent campaigns card.

- [ ] **Step 3: Update catch-all to redirect root**

In `src/app/partner/[[...slug]]/page.tsx`, add a redirect so that the empty key (`""`) redirects to `/partner/dashboard` instead of rendering the overview. This ensures the dedicated dashboard page handles the root route.

```typescript
// At the top of the function, after resolving key:
if (key === "") {
  redirect("/partner/dashboard");
}
```

Note: The `redirect` import from `next/navigation` is already present in the file.

- [ ] **Step 4: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`
Navigate to `/partner/` — should redirect to `/partner/dashboard` and show the new premium dashboard.

- [ ] **Step 5: Commit**

```bash
git add src/app/partner/dashboard/
git add src/app/partner/[[...slug]]/page.tsx
git commit -m "feat(partner): production dashboard with stat cards, quick actions, recent campaigns"
```

---

## Task 4: Clients Page with DataTable

**Files:**
- Create: `src/app/partner/clients/page.tsx`
- Create: `src/app/partner/clients/clients-table.tsx`
- Create: `src/app/partner/clients/loading.tsx`

- [ ] **Step 1: Create client table component**

Create `src/app/partner/clients/clients-table.tsx` as a `"use client"` component. Follow the pattern from `src/app/(dashboard)/directory/client-directory-table.tsx`.

The table takes `clients` as a prop (use the return type from `getClients()`). Columns:
1. **Client** — `DataTableRowLink` with name + slug below in muted text. Link to `/partner/clients/{slug}` (or just show name if no detail page yet — use `client.name` as display).
2. **Industry** — plain text, fallback "Not set"
3. **Size** — `sizeRange`, fallback "Not set"
4. **Campaigns** — `assessmentCount` (this is the campaign count from getClients), right-aligned, `tabular-nums`
5. **Diagnostics** — `sessionCount`, right-aligned, `tabular-nums`
6. **Status** — Badge: active = `default` variant, inactive = `outline` variant

Searchable columns: `["name"]`. No faceted filters needed initially.

Import from `@/components/data-table`: `DataTable`, `DataTableColumnHeader`, `DataTableRowLink`.

- [ ] **Step 2: Create page component**

Create `src/app/partner/clients/page.tsx` as a server component:

```typescript
import { PageHeader } from "@/components/page-header";
import { getClients } from "@/app/actions/clients";
import { ClientsTable } from "./clients-table";

export default async function PartnerClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Clients"
        title="Client portfolio"
        description={`${clients.length} client${clients.length !== 1 ? "s" : ""} in your portfolio.`}
      />
      <ClientsTable clients={clients} />
    </div>
  );
}
```

- [ ] **Step 3: Create loading skeleton**

Create `src/app/partner/clients/loading.tsx` using `DataTableLoading`:

```typescript
import { PageHeader } from "@/components/page-header";
import { DataTableLoading } from "@/components/data-table/data-table-loading";

export default function Loading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader eyebrow="Clients" title="Client portfolio" />
      <DataTableLoading columnCount={6} filterCount={1} />
    </div>
  );
}
```

- [ ] **Step 4: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`
Navigate to `/partner/clients` — should show the new DataTable with sorting and search.

- [ ] **Step 5: Commit**

```bash
git add src/app/partner/clients/
git commit -m "feat(partner): clients page with sortable, searchable DataTable"
```

---

## Task 5: Campaigns Page with DataTable

**Files:**
- Create: `src/app/partner/campaigns/page.tsx`
- Create: `src/app/partner/campaigns/campaigns-table.tsx`
- Create: `src/app/partner/campaigns/loading.tsx`

- [ ] **Step 1: Create campaigns table component**

Create `src/app/partner/campaigns/campaigns-table.tsx` as a `"use client"` component.

Data comes from `getCampaigns()` — check the return type in `src/app/actions/campaigns.ts`.

Columns:
1. **Campaign** — `DataTableRowLink` with title linking to `/partner/campaigns/{id}`, date range below in muted text (opens/closes)
2. **Client** — `clientName`, fallback "Not set"
3. **Status** — Badge with status variant mapping (active=default, draft=secondary, paused/archived/closed=outline, failed=destructive)
4. **Assessments** — `assessmentCount`, right-aligned, `tabular-nums`
5. **Participants** — `participantCount`, right-aligned, `tabular-nums`
6. **Completed** — `completedCount`, right-aligned, `tabular-nums`

Searchable columns: `["title"]`. Add a status faceted filter.

- [ ] **Step 2: Create page and loading components**

Page pattern identical to Task 4 but for campaigns:
- Server component calling `getCampaigns()`
- `PageHeader` with eyebrow "Campaigns", title "Campaigns", description showing count
- Loading skeleton with `DataTableLoading`

- [ ] **Step 3: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/campaigns/
git commit -m "feat(partner): campaigns listing with DataTable, status filter, search"
```

---

## Task 6: Participants Page with DataTable

**Files:**
- Create: `src/app/partner/participants/page.tsx`
- Create: `src/app/partner/participants/participants-table.tsx`
- Create: `src/app/partner/participants/loading.tsx`

- [ ] **Step 1: Create participants table component**

Follow `src/app/(dashboard)/participants/participants-table.tsx` closely — it's the gold standard. Create `src/app/partner/participants/participants-table.tsx`.

The data comes from `getParticipants()` — check the import path and return type from `src/app/actions/participants.ts`.

Columns (match admin):
1. **Participant** — Avatar + name + email below. `DataTableRowLink` linking to `/partner/campaigns/{campaignId}/participants/{id}`
2. **Campaign** — `campaignTitle`
3. **Status** — Badge with status variant mapping
4. **Progress** — Progress bar showing `completedSessions/totalSessions` if available, otherwise just status
5. **Last Activity** — Relative date with tooltip for full datetime

Searchable columns: `["displayName", "email"]`. Status faceted filter.

- [ ] **Step 2: Create page and loading components**

```typescript
import { PageHeader } from "@/components/page-header";
import { getParticipants } from "@/app/actions/participants";
import { ParticipantsTable } from "./participants-table";

export default async function PartnerParticipantsPage() {
  const { data: participants, total } = await getParticipants();

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="Participants"
        description={`${total} participant${total !== 1 ? "s" : ""} across all campaigns.`}
      />
      <ParticipantsTable participants={participants} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/participants/
git commit -m "feat(partner): participants page with DataTable, progress bars, status filter"
```

---

## Task 7: Assessments Page with DataTable

**Files:**
- Create: `src/app/partner/assessments/page.tsx`
- Create: `src/app/partner/assessments/assessments-table.tsx`
- Create: `src/app/partner/assessments/loading.tsx`

- [ ] **Step 1: Create assessments table component**

Create `src/app/partner/assessments/assessments-table.tsx`. Data from `getWorkspaceAssessmentSummaries()` (see import in workspace-portal-live.tsx).

Columns:
1. **Assessment** — title with description truncated below in muted text
2. **Client scope** — client names (show first name, or "N clients" if multiple)
3. **Status** — Badge with status variant
4. **Campaigns** — `campaignCount`, right-aligned, `tabular-nums`
5. **Participants** — `participantCount`, right-aligned, `tabular-nums`
6. **Completed** — `completedCount`, right-aligned, `tabular-nums`

Searchable columns: `["title"]`. Status faceted filter.

- [ ] **Step 2: Create page and loading components**

Same pattern as previous tasks. `PageHeader` with eyebrow "Assessments", title "Assessments", description showing count.

- [ ] **Step 3: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/assessments/
git commit -m "feat(partner): assessments page with DataTable and status filter"
```

---

## Task 8: Campaign Detail Page Cleanup

**Files:**
- Create: `src/app/partner/campaigns/[id]/page.tsx`
- Create: `src/app/partner/campaigns/[id]/loading.tsx`

- [ ] **Step 1: Extract and clean up campaign detail**

Extract the `WorkspaceCampaignDetailPage` logic from `workspace-portal-live.tsx` into a dedicated server component at `src/app/partner/campaigns/[id]/page.tsx`.

Key changes from the current implementation:
- Remove `WorkspaceAccessCard` (the debug card showing actor/scope/tenant info)
- Remove developer-note descriptions like "Campaign scope is enforced through the same tenant-aware access layer" — replace with the campaign's actual description or a clean default like the campaign title
- Remove "Campaign detail is scoped through client and partner memberships" — use the campaign's description
- Keep the same data fetching (`getCampaignById`), metrics, assessment lineup card, and participants table
- Update the participants table `CardDescription` from "Participant visibility is scoped through the same campaign access boundary" to just "Participants enrolled in this campaign"
- Keep the assessment lineup card but update its `CardDescription` from "These assessments are currently deployed inside this campaign" to "Assessments in this campaign"
- Use `PageHeader` with eyebrow as campaign status badge, title as campaign title, description as campaign description or client name + date range
- Back button links to `/partner/campaigns`

- [ ] **Step 2: Create loading skeleton**

- [ ] **Step 3: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/campaigns/[id]/
git commit -m "feat(partner): clean campaign detail page, remove debug scaffolding"
```

---

## Task 9: Participant Detail Page Cleanup

**Files:**
- Create: `src/app/partner/campaigns/[id]/participants/[participantId]/page.tsx`
- Create: `src/app/partner/campaigns/[id]/participants/[participantId]/loading.tsx`

- [ ] **Step 1: Extract and clean up participant detail**

Extract `WorkspaceParticipantDetailPage` logic into a dedicated route. Key changes:
- Remove `WorkspaceAccessCard`
- Remove "Participant detail is visible here because it belongs to the active campaign and workspace scope" — use participant email or campaign name
- Remove "Session visibility stays bounded to the participant and campaign you are authorised to view" — use "Assessment sessions for this participant"
- Remove "Auditable milestones in this participant journey" — use "Milestones and progress events"
- Clean up MetricCard for "Total time" which currently shows `value={totalDuration ? 1 : 0}` (nonsensical number) — consider showing duration as text in description instead
- Keep the same data fetching, sessions, activity timeline, report/export links
- Back button links to `/partner/campaigns/{campaignId}`

- [ ] **Step 2: Create loading skeleton**

- [ ] **Step 3: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/campaigns/[id]/participants/
git commit -m "feat(partner): clean participant detail page, remove debug scaffolding"
```

---

## Task 10: Remove Stale Catch-All Routes

**Files:**
- Modify: `src/app/partner/[[...slug]]/page.tsx`
- Modify: `src/components/workspace-portal-live.tsx` (remove partner-specific branches if desired, or leave as client-only)

- [ ] **Step 1: Update catch-all to redirect extracted routes**

Now that we have dedicated route files for `/partner/dashboard`, `/partner/clients`, `/partner/campaigns`, `/partner/campaigns/[id]`, `/partner/campaigns/[id]/participants/[participantId]`, `/partner/assessments`, and `/partner/participants`, update the catch-all to redirect these keys to their dedicated routes instead of rendering through the monolithic component.

```typescript
// In the catch-all page, after resolving key:
const dedicatedRoutes = ["", "clients", "campaigns", "assessments", "participants"];
const baseSegment = key.split("/")[0] ?? "";
if (dedicatedRoutes.includes(baseSegment) || key === "") {
  // Dedicated route files handle these — redirect
  redirect(`/partner/${key}`);
}
```

Wait — Next.js route resolution means if a dedicated file exists at `/partner/dashboard/page.tsx`, it will take precedence over `[[...slug]]` for that path. So no redirect is needed for routes that have dedicated files. The catch-all only fires for routes that DON'T have a dedicated file.

Actually, the catch-all `[[...slug]]` with double brackets means it matches the root AND any sub-path. But a more specific route file (like `partner/dashboard/page.tsx`) will take priority. So the catch-all will still handle routes we haven't extracted (like `/partner/diagnostics/[id]`).

Action: Simply update the catch-all to only handle routes that still need it. Remove the `""` (root/overview) case since dashboard now has its own route. If all partner pages have been extracted, the catch-all can be simplified to just handle edge cases or return `notFound()`.

- [ ] **Step 2: Clean up workspace-portal-live.tsx**

Remove the `WorkspaceAccessCard` component and all references to it throughout the file. This was the debug card showing actor/scope/tenant details on every page. Any remaining pages rendered through the catch-all (diagnostic detail, etc.) will also benefit.

Also clean up developer-note descriptions in the remaining page functions:
- `WorkspaceDiagnosticDetailPage`: "This diagnostic session is rendered through the same tenant-aware access layer as the rest of the portal" → "Overview and respondent details"
- `WorkspaceDiagnosticDetailPage`: "Respondent visibility remains inside the authorised client boundary for this session" → "Respondents in this session"
- Various `CardDescription` texts that mention tenant, access layer, scope boundary, etc. — replace with straightforward descriptions

- [ ] **Step 3: Verify build and test all routes**

Run: `pnpm build --filter=. 2>&1 | tail -20`
Test routes: `/partner/`, `/partner/dashboard`, `/partner/clients`, `/partner/campaigns`, `/partner/assessments`, `/partner/participants`

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/[[...slug]]/page.tsx
git add src/components/workspace-portal-live.tsx
git commit -m "refactor(partner): simplify catch-all, remove debug scaffolding from shared portal component"
```

---

## Task 11: Client Portal Secondary Pass (Optional)

**Files:**
- Modify: `src/components/app-sidebar.tsx:160-172` (client nav if needed)
- Verify: `src/app/client/` pages are production quality

- [ ] **Step 1: Audit client portal nav and pages**

Check if the client portal has similar issues:
- Developer notes in descriptions
- WorkspaceAccessCard showing on pages
- Navigation items that don't make sense

The client portal already has dedicated page files for dashboard, campaigns, participants, etc. — so it's structurally ahead. Focus on:
1. Ensuring descriptions/copy is production-ready (not developer notes)
2. Removing any WorkspaceAccessCard usage
3. Verifying the nav makes sense

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(client): production polish for client portal pages"
```
