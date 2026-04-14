# Participants & Sessions View Restructuring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the global Participants page to support both a deduplicated Participants view and a per-row Sessions view via a segmented control, and make the campaign Participants tab session-focused with a direct "View Results" button.

**Architecture:** The global `/participants` page gains a `Tabs` segmented control (existing UI component) that toggles between two DataTable configurations. A new `getUniqueParticipants` server action handles server-side email deduplication with proper pagination. The campaign participants tab (`CampaignParticipantManager`) is reframed with session-oriented columns and a "View Results" link, powered by joining `participant_sessions` in the `getCampaignById` query.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase, @tanstack/react-table, base-ui Tabs

**Spec:** `docs/superpowers/specs/2026-04-14-participants-sessions-views-design.md`

---

### Task 1: Add `getUniqueParticipants` server action

**Files:**
- Modify: `src/app/actions/participants.ts:29-35` (add new type after `ParticipantWithMeta`)
- Modify: `src/app/actions/participants.ts:90-177` (add new action after `getParticipants`)

- [ ] **Step 1: Add the `UniqueParticipant` type**

In `src/app/actions/participants.ts`, add this type after `ParticipantWithMeta` (around line 36):

```ts
export type UniqueParticipant = {
  /** ID of the most recent campaign_participants record for this email */
  id: string
  email: string
  firstName?: string
  lastName?: string
  /** Total campaign_participants rows for this email */
  sessionCount: number
  /** Status from the most recent record */
  latestStatus: CampaignParticipantStatus
  lastActivity?: string
}
```

- [ ] **Step 2: Add the `getUniqueParticipants` action**

Add this function after the `getParticipants` function (after line 177):

```ts
export async function getUniqueParticipants(filters?: {
  status?: CampaignParticipantStatus
  search?: string
  page?: number
  perPage?: number
}): Promise<{ data: UniqueParticipant[]; total: number }> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()
  const page = filters?.page ?? 1
  const perPage = filters?.perPage ?? 50
  const offset = (page - 1) * perPage
  let scopedCampaignIds: string[] | null = null

  if (!scope.isPlatformAdmin) {
    scopedCampaignIds = await getAccessibleCampaignIds(scope)
    if (!scopedCampaignIds || scopedCampaignIds.length === 0) {
      return { data: [], total: 0 }
    }
  }

  // Use RPC or raw query to group by email with proper pagination.
  // Supabase JS client doesn't support GROUP BY, so we use two queries:
  // 1) Get all matching rows (scoped)
  // 2) Deduplicate in JS (acceptable because campaign_participants is bounded per-scope)

  let query = db
    .from('campaign_participants')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (scopedCampaignIds && scopedCampaignIds.length === 1) {
    query = query.eq('campaign_id', scopedCampaignIds[0])
  } else if (scopedCampaignIds && scopedCampaignIds.length > 1) {
    query = query.in('campaign_id', scopedCampaignIds)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.search) {
    query = query.or(
      `email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`
    )
  }

  const { data: rows, error } = await query

  if (error) {
    throwActionError('getUniqueParticipants', 'Unable to load participants.', error)
  }

  // Group by email — keep the most recent record per email
  const byEmail = new Map<string, { latest: any; count: number }>()
  for (const row of rows ?? []) {
    const email = (row.email as string).toLowerCase()
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, { latest: row, count: 1 })
    } else {
      existing.count++
      // rows are ordered by created_at desc, so first seen is most recent
    }
  }

  const allUnique = Array.from(byEmail.values())
  const total = allUnique.length
  const pageSlice = allUnique.slice(offset, offset + perPage)

  const data: UniqueParticipant[] = pageSlice.map(({ latest, count }) => {
    const mapped = mapCampaignParticipantRow(latest)
    const timestamps = [
      latest.invited_at,
      latest.started_at,
      latest.completed_at,
    ].filter(Boolean)

    return {
      id: mapped.id,
      email: mapped.email,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      sessionCount: count,
      latestStatus: mapped.status,
      lastActivity: timestamps.length > 0
        ? timestamps.sort().reverse()[0]
        : latest.created_at,
    }
  })

  return { data, total }
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/participants.ts
git commit -m "Add getUniqueParticipants server action for deduplicated participants view"
```

---

### Task 2: Add segmented control to admin global participants page

**Files:**
- Modify: `src/app/(dashboard)/participants/page.tsx`
- Modify: `src/app/(dashboard)/participants/participants-table.tsx`

- [ ] **Step 1: Update the page to handle the view query param and fetch both data sets**

Replace `src/app/(dashboard)/participants/page.tsx` with:

```tsx
import { PageHeader } from "@/components/page-header";
import { getParticipants, getUniqueParticipants } from "@/app/actions/participants";
import { ParticipantsTable } from "./participants-table";

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "sessions" ? "sessions" : "participants";

  const [sessionsResult, participantsResult] = await Promise.all([
    view === "sessions" ? getParticipants() : Promise.resolve(null),
    view === "participants" ? getUniqueParticipants() : Promise.resolve(null),
  ]);

  const total = view === "sessions"
    ? (sessionsResult?.total ?? 0)
    : (participantsResult?.total ?? 0);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="Participants"
        description={`${total} ${view === "participants" ? "participant" : "session"}${total !== 1 ? "s" : ""} across all campaigns.`}
      />

      <ParticipantsTable
        view={view}
        sessions={sessionsResult?.data ?? []}
        participants={participantsResult?.data ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite participants-table.tsx with dual view support**

Replace `src/app/(dashboard)/participants/participants-table.tsx`. The key changes:

1. Add `Tabs`/`TabsList`/`TabsTrigger` segmented control above the table
2. Two column definitions — one for each view
3. Sessions view: current columns + "View Results" button (replacing the row link to participant detail)
4. Participants view: Name/Email, Sessions count, Latest status, Last activity
5. Toggling view navigates via `router.push` with query param (resets filters)

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, FileBarChart, Trash2 } from "lucide-react";

import { bulkDeleteParticipants, bulkUpdateParticipantStatus } from "@/app/actions/participants";
import type { ParticipantWithMeta, UniqueParticipant } from "@/app/actions/participants";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
  type BulkAction,
} from "@/components/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  registered: "Registered",
  in_progress: "In Progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDisplayName(p: { firstName?: string; lastName?: string; email: string }) {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return name || p.email;
}

function getInitials(p: { firstName?: string; email: string }) {
  return (p.firstName?.[0] ?? p.email[0] ?? "?").toUpperCase();
}

// ---------------------------------------------------------------------------
// Sessions view columns (existing behavior + View Results button)
// ---------------------------------------------------------------------------

type SessionTableRow = ParticipantWithMeta & {
  displayName: string;
  progressValue: number;
  lastActivityValue: string;
};

function SessionRowActions({ participant }: { participant: SessionTableRow }) {
  const router = useRouter();

  return (
    <DataTableActionsMenu label={`Open actions for ${participant.displayName}`}>
      <DropdownMenuItem onClick={() => router.push(`/participants/${participant.id}`)}>
        <ExternalLink className="size-4" />
        Open participant
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => router.push(`/campaigns/${participant.campaignId}/overview`)}
      >
        <ExternalLink className="size-4" />
        Open campaign
      </DropdownMenuItem>
    </DataTableActionsMenu>
  );
}

const sessionsColumns: ColumnDef<SessionTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/participants/${row.original.id}`}
        ariaLabel={`Open ${row.original.displayName}`}
        className="min-w-0"
      >
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback>{getInitials(row.original)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold hover:text-primary">
              {row.original.displayName}
            </p>
            <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: "campaignTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Campaign" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.campaignTitle}</span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </Badge>
    ),
  },
  {
    id: "progress",
    accessorFn: (row) => row.progressValue,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Progress" />
    ),
    cell: ({ row }) => (
      <div className="min-w-32 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {row.original.completedSessionCount}/{row.original.sessionCount}
          </span>
          <span>{row.original.progressValue}%</span>
        </div>
        <Progress value={row.original.progressValue} className="gap-0" />
      </div>
    ),
  },
  {
    id: "lastActivity",
    accessorFn: (row) => row.lastActivityValue,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Activity" />
    ),
    cell: ({ row }) =>
      row.original.lastActivity ? (
        <Tooltip>
          <TooltipTrigger
            render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
          >
            {formatRelativeDate(row.original.lastActivity)}
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(row.original.lastActivity)}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => <SessionRowActions participant={row.original} />,
  },
];

const sessionsBulkActions: BulkAction<SessionTableRow>[] = [
  {
    label: "Delete",
    variant: "destructive",
    icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
    action: async (ids) => {
      await bulkDeleteParticipants(ids);
    },
  },
  {
    label: "Mark Completed",
    action: async (ids) => {
      await bulkUpdateParticipantStatus(ids, "completed");
    },
  },
  {
    label: "Withdraw",
    action: async (ids) => {
      await bulkUpdateParticipantStatus(ids, "withdrawn");
    },
  },
];

// ---------------------------------------------------------------------------
// Participants view columns (deduplicated by email)
// ---------------------------------------------------------------------------

type ParticipantTableRow = UniqueParticipant & {
  displayName: string;
  lastActivityValue: string;
};

const participantsColumns: ColumnDef<ParticipantTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/participants/${row.original.id}`}
        ariaLabel={`Open ${row.original.displayName}`}
        className="min-w-0"
      >
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback>{getInitials(row.original)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold hover:text-primary">
              {row.original.displayName}
            </p>
            <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: "sessionCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sessions" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.sessionCount}
      </span>
    ),
  },
  {
    accessorKey: "latestStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latest Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.latestStatus] ?? "secondary"}>
        {STATUS_LABEL[row.original.latestStatus] ?? row.original.latestStatus}
      </Badge>
    ),
  },
  {
    id: "lastActivity",
    accessorFn: (row) => row.lastActivityValue,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Activity" />
    ),
    cell: ({ row }) =>
      row.original.lastActivity ? (
        <Tooltip>
          <TooltipTrigger
            render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
          >
            {formatRelativeDate(row.original.lastActivity)}
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(row.original.lastActivity)}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ParticipantsTable({
  view,
  sessions,
  participants,
}: {
  view: "participants" | "sessions";
  sessions: ParticipantWithMeta[];
  participants: UniqueParticipant[];
}) {
  const router = useRouter();

  function handleViewChange(newView: string | null) {
    if (!newView) return;
    if (newView === "participants") {
      router.push("/participants");
    } else {
      router.push("/participants?view=sessions");
    }
  }

  if (view === "sessions") {
    const rows: SessionTableRow[] = sessions.map((s) => ({
      ...s,
      displayName: getDisplayName(s),
      progressValue:
        s.sessionCount === 0
          ? 0
          : Math.round((s.completedSessionCount / s.sessionCount) * 100),
      lastActivityValue: s.lastActivity ?? "",
    }));

    return (
      <div className="space-y-4">
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsList>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
        </Tabs>

        <DataTable
          columns={sessionsColumns}
          data={rows}
          searchableColumns={["displayName", "email"]}
          searchPlaceholder="Search sessions"
          filterableColumns={[
            {
              id: "status",
              title: "Status",
              options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            },
            {
              id: "campaignTitle",
              title: "Campaign",
              options: Array.from(new Set(rows.map((row) => row.campaignTitle))).map(
                (campaign) => ({
                  label: campaign,
                  value: campaign,
                }),
              ),
            },
          ]}
          defaultSort={{ id: "lastActivity", desc: true }}
          rowHref={(row) => `/participants/${row.id}`}
          pageSize={20}
          enableRowSelection
          getRowId={(row) => row.id}
          bulkActions={sessionsBulkActions}
        />
      </div>
    );
  }

  // Participants view (deduplicated)
  const rows: ParticipantTableRow[] = participants.map((p) => ({
    ...p,
    displayName: getDisplayName(p),
    lastActivityValue: p.lastActivity ?? "",
  }));

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={handleViewChange}>
        <TabsList>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={participantsColumns}
        data={rows}
        searchableColumns={["displayName", "email"]}
        searchPlaceholder="Search participants"
        filterableColumns={[
          {
            id: "latestStatus",
            title: "Status",
            options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value,
              label,
            })),
          },
        ]}
        defaultSort={{ id: "lastActivity", desc: true }}
        rowHref={(row) => `/participants/${row.id}`}
        pageSize={20}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/participants/page.tsx src/app/\(dashboard\)/participants/participants-table.tsx
git commit -m "Add segmented Participants/Sessions toggle to global participants page"
```

---

### Task 3: Join `participant_sessions` in `getCampaignById`

**Files:**
- Modify: `src/app/actions/campaigns.ts:166-170` (participant query)
- Modify: `src/app/actions/campaigns.ts:192` (participant mapping)
- Modify: `src/app/actions/campaigns.ts:38-43` (`CampaignDetail` type)
- Modify: `src/types/database.ts:1592-1621` (`CampaignParticipant` interface)

- [ ] **Step 1: Extend `CampaignParticipant` type with optional sessions array**

In `src/types/database.ts`, add to the end of the `CampaignParticipant` interface (before the closing `}`):

```ts
  /** Participant sessions loaded via join (optional — only populated by getCampaignById). */
  participantSessions?: { id: string; status: string }[]
```

- [ ] **Step 2: Update the participant query in `getCampaignById`**

In `src/app/actions/campaigns.ts`, change the participant query (around line 166-170) from:

```ts
    db
      .from('campaign_participants')
      .select('*')
      .eq('campaign_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
```

to:

```ts
    db
      .from('campaign_participants')
      .select('*, participant_sessions(id, status)')
      .eq('campaign_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
```

- [ ] **Step 3: Update the participant mapping to include sessions**

In `src/app/actions/campaigns.ts`, change the participant mapping (around line 192) from:

```ts
    participants: (participantRows ?? []).map(mapCampaignParticipantRow),
```

to:

```ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: (participantRows ?? []).map((r: any) => ({
      ...mapCampaignParticipantRow(r),
      participantSessions: (r.participant_sessions ?? []).map((s: any) => ({
        id: s.id as string,
        status: s.status as string,
      })),
    })),
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/app/actions/campaigns.ts
git commit -m "Join participant_sessions in getCampaignById for session linking"
```

---

### Task 4: Reframe campaign participant manager as session-focused

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`

- [ ] **Step 1: Add session-focused columns and View Results button**

In `campaign-participant-manager.tsx`, replace the `columns` definition (around line 292-368) with the updated version. Key changes:
- Add `startedAt` and `completedAt` columns
- Add "View Results" button column
- Remove the Link wrapper on participant name (no longer primary action)
- Keep copy-link, send-email, remove in the actions column

Replace the existing `columns` array and the `rows` mapping with:

```tsx
  const rows = participants.map((participant) => ({
    ...participant,
    displayName: getDisplayName(participant),
    /** Pick the most recent participant_session ID (if any) */
    latestSessionId: participant.participantSessions
      ?.slice()
      .reverse()
      .find((s) => s.status === "completed" || s.status === "in_progress")?.id
      ?? participant.participantSessions?.[participant.participantSessions.length - 1]?.id,
  }));

  type Row = (typeof rows)[number];

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participant" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {(row.original.firstName?.[0] ?? row.original.email[0]).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      id: "startedAt",
      accessorFn: (row) => row.startedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Started" />
      ),
      cell: ({ row }) =>
        row.original.startedAt ? (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.startedAt).toLocaleDateString("en-AU", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "completedAt",
      accessorFn: (row) => row.completedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completed" />
      ),
      cell: ({ row }) =>
        row.original.completedAt ? (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.completedAt).toLocaleDateString("en-AU", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "viewResults",
      enableSorting: false,
      header: () => <span className="text-xs text-muted-foreground">Results</span>,
      cell: ({ row }) => {
        const canView = ["in_progress", "completed"].includes(row.original.status) && row.original.latestSessionId;
        return (
          <Button
            size="sm"
            variant="ghost"
            disabled={!canView}
            asChild={!!canView}
            className={!canView ? "opacity-50" : ""}
          >
            {canView ? (
              <Link href={`/campaigns/${campaignId}/sessions/${row.original.latestSessionId}`}>
                <FileBarChart className="size-4" />
                View Results
              </Link>
            ) : (
              <span>
                <FileBarChart className="size-4" />
                View Results
              </span>
            )}
          </Button>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DataTableRowActions>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Copy assessment link"
            onClick={() => copyLink(row.original.accessToken)}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title={
              row.original.status === "invited" ? "Send invite email" : "Resend invite email"
            }
            onClick={() => handleSendEmail(row.original.id, row.original.email)}
          >
            <Mail className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => handleRemove(row.original.id, row.original.displayName)}
          >
            <Trash2 className="size-4" />
          </Button>
        </DataTableRowActions>
      ),
    },
  ];
```

- [ ] **Step 2: Update imports**

Add `FileBarChart` to the lucide-react imports:

```ts
import { Copy, ExternalLink, FileBarChart, Mail, Plus, Trash2, Upload } from "lucide-react";
```

Remove `ExternalLink` if it is no longer used after removing the participant detail link.

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/campaigns/\[id\]/participants/campaign-participant-manager.tsx
git commit -m "Reframe campaign participants as session-focused with View Results button"
```

---

### Task 5: Mirror changes to partner portal global participants page

**Files:**
- Modify: `src/app/partner/participants/page.tsx`
- Modify: `src/app/partner/participants/participants-table.tsx`

- [ ] **Step 1: Update partner participants page to handle view param**

Update `src/app/partner/participants/page.tsx` to accept `searchParams`, determine the view, and call the appropriate action — following the same pattern as Task 2 Step 1. The partner page uses `getParticipants()` (same as admin), so this is structurally identical.

```tsx
import { PageHeader } from "@/components/page-header";
import { getParticipants, getUniqueParticipants } from "@/app/actions/participants";
import { ParticipantsTable } from "./participants-table";

export default async function PartnerParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "sessions" ? "sessions" : "participants";

  const [sessionsResult, participantsResult] = await Promise.all([
    view === "sessions" ? getParticipants() : Promise.resolve(null),
    view === "participants" ? getUniqueParticipants() : Promise.resolve(null),
  ]);

  const total = view === "sessions"
    ? (sessionsResult?.total ?? 0)
    : (participantsResult?.total ?? 0);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="Participants"
        description={`${total} ${view === "participants" ? "participant" : "session"}${total !== 1 ? "s" : ""} across all campaigns.`}
      />

      <ParticipantsTable
        view={view}
        sessions={sessionsResult?.data ?? []}
        participants={participantsResult?.data ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace partner participants-table.tsx**

The partner table currently has the same structure as the admin table but without bulk actions and with portal-aware hrefs (`/partner/participants/...`). Rewrite it to import from the shared admin `ParticipantsTable` component, OR duplicate with portal-aware paths.

Since the partner table already has different row actions (no bulk actions, different navigation paths), the simplest approach is to refactor it to follow the same dual-view pattern as the admin table (Task 2 Step 2), but with `href` paths prefixed with `/partner/`. Copy the admin `ParticipantsTable` pattern but:
- Remove bulk actions entirely (partner portal doesn't have them)
- Change all hrefs from `/participants/` to `/partner/participants/` and `/campaigns/` to `/partner/campaigns/`

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/partner/participants/page.tsx src/app/partner/participants/participants-table.tsx
git commit -m "Mirror Participants/Sessions segmented control to partner portal"
```

---

### Task 6: Mirror changes to client portal global participants page

**Files:**
- Modify: `src/app/client/participants/page.tsx`
- Modify: `src/app/client/participants/global-participants.tsx`

The client portal uses `getParticipantsForClient` (not `getParticipants`), so the data source is different. The segmented control pattern is the same but must call the client-specific action.

- [ ] **Step 1: Check the `getParticipantsForClient` return type**

Read `src/app/actions/campaigns.ts` to find `getParticipantsForClient` and its return type. If it returns `ClientParticipant[]` (which has different fields from `ParticipantWithMeta`), the client portal will need its own deduplication logic or a new `getUniqueParticipantsForClient` action.

Implement accordingly — the pattern is identical to Tasks 1-2 but scoped to the client's data.

- [ ] **Step 2: Update global-participants.tsx with segmented control**

Follow the same dual-view pattern. The client portal currently uses `ClientParticipant` type. Add the Tabs toggle and two column sets.

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/client/participants/page.tsx src/app/client/participants/global-participants.tsx
git commit -m "Mirror Participants/Sessions segmented control to client portal"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build check**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Manual testing checklist**

Test the following in the admin portal:

1. Navigate to `/participants` — should show deduplicated Participants view by default
2. Click "Sessions" toggle — URL changes to `?view=sessions`, table shows per-session rows with Campaign column
3. Click "Participants" toggle — filters/search reset, table shows deduplicated rows
4. Participants view: same email appearing in multiple campaigns shows as one row with correct session count
5. Navigate to a campaign → Participants tab — table shows session-focused columns (Started, Completed, View Results)
6. "View Results" button is disabled for `invited`/`registered` participants
7. "View Results" button links to `/campaigns/{id}/sessions/{sessionId}` for `in_progress`/`completed` participants
8. Invite and bulk import still work correctly

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "Fix issues found during manual verification"
```
