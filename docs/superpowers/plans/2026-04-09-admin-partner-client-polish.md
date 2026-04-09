# Admin Partner & Client Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin partner and client management areas to production quality with consistent tab structures, rich overview dashboards, DataTable-based assignment UIs, a new Library tab for taxonomy management, and layout consistency.

**Architecture:** Both partner and client admin shells get new tabs (Details, Assessments, Reports, Library for partner). Overview pages become read-only dashboards with stats and quick actions. Edit forms move to a dedicated Details tab. All assignment views convert from card-based to DataTable-based layouts. New DB migration adds profile fields to partners and a taxonomy assignment table.

**Tech Stack:** Next.js (App Router), TanStack React Table via `DataTable`, Tailwind CSS, Supabase server actions, lucide-react icons, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-04-09-admin-partner-client-polish-design.md`

**Key reference files (read these before starting any task):**
- Admin dashboard (gold standard): `src/app/(dashboard)/dashboard/page.tsx`
- DataTable components: `src/components/data-table/`
- Premium UI: `src/components/scroll-reveal.tsx`, `src/components/tilt-card.tsx`, `src/components/animated-number.tsx`, `src/components/mini-bars.tsx`
- Page header: `src/components/page-header.tsx`
- Partner actions: `src/app/actions/partners.ts`
- Partner entitlements: `src/app/actions/partner-entitlements.ts`
- Client entitlements: `src/app/actions/client-entitlements.ts`
- Mappers: `src/lib/supabase/mappers.ts`
- Types: `src/types/database.ts`
- CLAUDE.md — UI/UX standards

**DB table naming note:** The taxonomy tables in Supabase are `dimensions`, `factors` (formerly competencies), and `constructs` (formerly traits). TypeScript types are `Dimension`, `Factor`, `Construct`. The hierarchy is: Dimension → Factor → Construct.

---

## Task 1: Database Migration — Partner Profile Fields

**Files:**
- Create: `supabase/migrations/20260410100000_partner_profile_fields.sql`
- Modify: `src/types/database.ts:186-203`
- Modify: `src/lib/supabase/mappers.ts:202-213`

- [ ] **Step 1: Create the migration**

```sql
-- Add profile fields to partners for the new Details tab
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS notes TEXT;
```

- [ ] **Step 2: Update Partner TypeScript interface**

In `src/types/database.ts`, find the `Partner` interface (line 186). Add after `canCustomizeBranding`:

```typescript
  /** Optional description of the partner. */
  description?: string
  /** Partner website URL. */
  website?: string
  /** Primary contact email. */
  contactEmail?: string
  /** Internal notes (not visible to partner users). */
  notes?: string
```

- [ ] **Step 3: Update mapPartnerRow**

In `src/lib/supabase/mappers.ts`, find `mapPartnerRow` (line 202). Add to the return object:

```typescript
    description: row.description ?? undefined,
    website: row.website ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    notes: row.notes ?? undefined,
```

- [ ] **Step 4: Update updatePartner action**

In `src/app/actions/partners.ts`, find the `updatePartner` function (line 151). Update the `raw` object to include new fields:

```typescript
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    isActive: formData.get('isActive') !== 'false',
    description: (formData.get('description') as string) || undefined,
    website: (formData.get('website') as string) || undefined,
    contactEmail: (formData.get('contactEmail') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  }
```

And update the `.update()` call to include them:

```typescript
  const { error } = await db
    .from('partners')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      is_active: parsed.data.isActive,
      description: raw.description ?? null,
      website: raw.website ?? null,
      contact_email: raw.contactEmail ?? null,
      notes: raw.notes ?? null,
    })
    .eq('id', id)
```

Note: The validation schema (`partnerSchema`) may need to be updated to allow these optional fields. Check `src/lib/validations/partners.ts` and add them as optional strings if not present.

- [ ] **Step 5: Push migration and verify**

Run: `npx supabase db push` (or the project's db push command — check `package.json` for the script)
Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260410100000_partner_profile_fields.sql src/types/database.ts src/lib/supabase/mappers.ts src/app/actions/partners.ts
git commit -m "feat(partner): add description, website, contact_email, notes to partners table"
```

---

## Task 2: Database Migration — Partner Taxonomy Assignments

**Files:**
- Create: `supabase/migrations/20260410100001_partner_taxonomy_assignments.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Create the migration**

```sql
-- Partner taxonomy assignments: which dimensions/factors/constructs a partner can use
CREATE TABLE IF NOT EXISTS partner_taxonomy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('dimension', 'factor', 'construct')),
  entity_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_taxonomy_partner
  ON partner_taxonomy_assignments(partner_id, entity_type);

-- Updated-at trigger
DROP TRIGGER IF EXISTS trg_partner_taxonomy_assignments_updated ON partner_taxonomy_assignments;
CREATE TRIGGER trg_partner_taxonomy_assignments_updated
  BEFORE UPDATE ON partner_taxonomy_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE partner_taxonomy_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON partner_taxonomy_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "partner_members_select_own" ON partner_taxonomy_assignments
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.revoked_at IS NULL
    )
  );
```

- [ ] **Step 2: Add TypeScript type**

In `src/types/database.ts`, after the `PartnerAssessmentAssignmentWithUsage` interface (around line 1861), add:

```typescript
export interface PartnerTaxonomyAssignment {
  id: string
  partnerId: string
  entityType: 'dimension' | 'factor' | 'construct'
  entityId: string
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Push migration and verify**

Run: `npx supabase db push`
Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260410100001_partner_taxonomy_assignments.sql src/types/database.ts
git commit -m "feat(partner): add partner_taxonomy_assignments table"
```

---

## Task 3: Update Shell Tab Structures

**Files:**
- Modify: `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`
- Modify: `src/app/(dashboard)/directory/partner-directory-table.tsx`

- [ ] **Step 1: Update partner shell tabs**

Replace the `tabs` array in `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`:

```typescript
const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Details", segment: "details" },
  { label: "Clients", segment: "clients" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Library", segment: "library" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];
```

Also change `max-w-5xl` to `max-w-6xl` in the outer div.

- [ ] **Step 2: Update client shell tabs**

Replace the `tabs` array in `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`:

```typescript
const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Details", segment: "details" },
  { label: "Assessments", segment: "assessments" },
  { label: "Reports", segment: "reports" },
  { label: "Users", segment: "users" },
  { label: "Branding", segment: "branding" },
  { label: "Settings", segment: "settings" },
];
```

Also change `max-w-5xl` to `max-w-6xl` in the outer div.

- [ ] **Step 3: Fix partner directory rowHref**

In `src/app/(dashboard)/directory/partner-directory-table.tsx`, find the `rowHref` prop (search for `/edit`). Change:

```typescript
// From:
rowHref={(row) => `/partners/${row.slug}/edit`}
// To:
rowHref={(row) => `/partners/${row.slug}/overview`}
```

Also update the `DataTableRowLink` href in the Name column to match.

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`
Expected: Build succeeds (new tab pages don't exist yet — they'll 404 but the shell renders)

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx src/app/(dashboard)/directory/partner-directory-table.tsx
git commit -m "feat(admin): update partner/client shell tabs, widen to max-w-6xl, fix directory links"
```

---

## Task 4: Partner Overview — Rich Dashboard

**Files:**
- Modify: `src/app/(dashboard)/partners/[slug]/overview/page.tsx`
- Rewrite: `src/app/(dashboard)/partners/[slug]/overview/partner-overview.tsx`
- Rewrite: `src/app/(dashboard)/partners/[slug]/overview/partner-stats.tsx`

- [ ] **Step 1: Rewrite partner stats with premium styling**

Rewrite `partner-stats.tsx` to use TiltCard + ScrollReveal + AnimatedNumber, matching the dashboard page pattern:

```typescript
import Link from "next/link";
import { Building2, ClipboardList, Megaphone, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/animated-number";
import { MiniBars } from "@/components/mini-bars";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";

type PartnerStatsProps = {
  clientCount: number;
  activeCampaignCount: number;
  partnerMemberCount: number;
  totalAssessmentsAssigned: number;
  partnerSlug: string;
};

const statCards = [
  { key: "clientCount" as const, title: "Clients", icon: Building2, segment: "clients" },
  { key: "activeCampaignCount" as const, title: "Active Campaigns", icon: Megaphone, segment: null },
  { key: "partnerMemberCount" as const, title: "Members", icon: Users, segment: "users" },
  { key: "totalAssessmentsAssigned" as const, title: "Assessments", icon: ClipboardList, segment: "assessments" },
];

export function PartnerStats(props: PartnerStatsProps) {
  const glowColor = "var(--muted-foreground)";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => {
        const content = (
          <ScrollReveal key={stat.key} delay={index * 60}>
            <TiltCard>
              <Card variant="interactive" className="relative overflow-hidden">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <AnimatedNumber
                        value={props[stat.key]}
                        className="text-3xl font-bold tabular-nums"
                      />
                      <MiniBars color={glowColor} />
                      <p className="text-caption text-muted-foreground mt-1">
                        {stat.title}
                      </p>
                    </div>
                    <div
                      className="flex size-10 items-center justify-center rounded-xl bg-muted transition-all duration-300 group-hover/card:shadow-[0_0_20px_var(--glow-color)]"
                      style={{ "--glow-color": glowColor } as React.CSSProperties}
                    >
                      <stat.icon className="size-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
                <div className="h-[2px] bg-muted-foreground/30 opacity-50" />
              </Card>
            </TiltCard>
          </ScrollReveal>
        );

        if (stat.segment) {
          return (
            <Link key={stat.key} href={`/partners/${props.partnerSlug}/${stat.segment}`}>
              {content}
            </Link>
          );
        }
        return <div key={stat.key}>{content}</div>;
      })}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite partner overview component**

Replace `partner-overview.tsx` with a rich dashboard showing Key Context + Quick Actions + Recent Campaigns:

```typescript
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  ExternalLink,
  Library,
  Megaphone,
  UserPlus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/scroll-reveal";
import { TiltCard } from "@/components/tilt-card";
import { PartnerStats } from "./partner-stats";
import type { Partner } from "@/types/database";

interface PartnerOverviewProps {
  partner: Partner;
  stats: {
    clientCount: number;
    activeCampaignCount: number;
    partnerMemberCount: number;
    totalAssessmentsAssigned: number;
  };
  recentCampaigns: Array<{
    id: string;
    title: string;
    clientName: string;
    status: string;
    participantCount: number;
    completedCount: number;
  }>;
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  draft: "secondary",
  paused: "outline",
  archived: "outline",
  closed: "outline",
  failed: "destructive",
};

export function PartnerOverview({ partner, stats, recentCampaigns }: PartnerOverviewProps) {
  const quickActions = [
    { title: "View Clients", href: `/partners/${partner.slug}/clients`, icon: Building2, description: "Manage client portfolio" },
    { title: "Manage Assessments", href: `/partners/${partner.slug}/assessments`, icon: ClipboardList, description: "Assessment assignments" },
    { title: "Manage Library", href: `/partners/${partner.slug}/library`, icon: Library, description: "Taxonomy entities" },
    { title: "Enter Portal", href: `/partner/dashboard`, icon: ExternalLink, description: "View as partner" },
    { title: "Invite User", href: `/partners/${partner.slug}/users`, icon: UserPlus, description: "Add a team member" },
  ];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <PartnerStats {...stats} partnerSlug={partner.slug} />

      {/* Key Context + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Key Context */}
        <ScrollReveal delay={0} className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Partner Profile</CardTitle>
              <CardDescription>
                <Link
                  href={`/partners/${partner.slug}/details`}
                  className="text-primary hover:underline"
                >
                  Edit details →
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {partner.description && (
                <div>
                  <p className="text-caption text-muted-foreground">Description</p>
                  <p className="text-sm">{partner.description}</p>
                </div>
              )}
              {partner.website && (
                <div>
                  <p className="text-caption text-muted-foreground">Website</p>
                  <p className="text-sm">{partner.website}</p>
                </div>
              )}
              {partner.contactEmail && (
                <div>
                  <p className="text-caption text-muted-foreground">Contact</p>
                  <p className="text-sm">{partner.contactEmail}</p>
                </div>
              )}
              {partner.notes && (
                <div>
                  <p className="text-caption text-muted-foreground">Internal Notes</p>
                  <p className="text-sm text-muted-foreground">{partner.notes}</p>
                </div>
              )}
              {!partner.description && !partner.website && !partner.contactEmail && !partner.notes && (
                <p className="text-sm text-muted-foreground">
                  No profile details yet.{" "}
                  <Link href={`/partners/${partner.slug}/details`} className="text-primary hover:underline">
                    Add details →
                  </Link>
                </p>
              )}
              <div>
                <p className="text-caption text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(partner.created_at).toLocaleDateString(undefined, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Quick Actions */}
        <ScrollReveal delay={60} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted group"
                >
                  <action.icon className="size-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{action.title}</p>
                    <p className="text-caption text-muted-foreground truncate">{action.description}</p>
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      {/* Recent Campaigns */}
      <ScrollReveal delay={120}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Latest campaign activity across this partner&apos;s clients</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No campaigns yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{campaign.title}</p>
                      <p className="text-caption text-muted-foreground">{campaign.clientName}</p>
                    </div>
                    <Badge variant={statusVariant[campaign.status] ?? "outline"}>
                      {campaign.status}
                    </Badge>
                    <div className="text-right tabular-nums text-muted-foreground shrink-0">
                      <p>{campaign.participantCount} participants</p>
                      <p className="text-caption">{campaign.completedCount} completed</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  );
}
```

- [ ] **Step 3: Update partner overview page**

Rewrite `page.tsx` to fetch partner with new fields and recent campaigns, remove the edit form:

```typescript
import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug, getPartnerStats } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerOverview } from "./partner-overview";
import { getRecentPartnerCampaigns } from "@/app/actions/partners";

export default async function PartnerOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  const [stats, recentCampaigns] = await Promise.all([
    getPartnerStats(partner.id),
    getRecentPartnerCampaigns(partner.id),
  ]);

  return (
    <PartnerOverview
      partner={partner}
      stats={stats}
      recentCampaigns={recentCampaigns}
    />
  );
}
```

- [ ] **Step 4: Add getRecentPartnerCampaigns action**

In `src/app/actions/partners.ts`, add at the bottom:

```typescript
export async function getRecentPartnerCampaigns(partnerId: string): Promise<
  Array<{
    id: string;
    title: string;
    clientName: string;
    status: string;
    participantCount: number;
    completedCount: number;
  }>
> {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  // Get client IDs for this partner
  const { data: clientRows } = await db
    .from('clients')
    .select('id')
    .eq('partner_id', partnerId)
    .is('deleted_at', null)

  const clientIds = (clientRows ?? []).map((c) => c.id)
  if (clientIds.length === 0) return []

  // Note: participant_count and completed_count are NOT columns on campaigns.
  // They must be derived from campaign_participants. Use a count join.
  const { data, error } = await db
    .from('campaigns')
    .select('id, title, status, clients(name), campaign_participants(count)')
    .in('client_id', clientIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return []

  // For completed count, we need a separate query or compute from participants.
  // Simplify: show total participants only. Check getCampaigns() in
  // src/app/actions/campaigns.ts for the full pattern if completed count is needed.
  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients
    const participantCount = row.campaign_participants
      ? ((row.campaign_participants as { count: number }[])[0]?.count ?? 0)
      : 0
    return {
      id: row.id,
      title: row.title,
      clientName: (client as { name: string })?.name ?? 'Unknown',
      status: row.status,
      participantCount,
      completedCount: 0, // TODO: derive from campaign_participants with status='completed' if needed
    }
  })
}
```

- [ ] **Step 5: Update overview loading.tsx**

The existing `src/app/(dashboard)/partners/[slug]/overview/loading.tsx` has a skeleton matching the old edit-form layout. Update it to match the new dashboard layout:

```typescript
export default function PartnerOverviewLoading() {
  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/40 animate-shimmer" />
        ))}
      </div>
      {/* Key Context + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-48 rounded-xl bg-muted/40 animate-shimmer lg:col-span-3" />
        <div className="h-48 rounded-xl bg-muted/40 animate-shimmer lg:col-span-2" />
      </div>
      {/* Recent Campaigns */}
      <div className="h-48 rounded-xl bg-muted/40 animate-shimmer" />
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/partners/[slug]/overview/ src/app/actions/partners.ts
git commit -m "feat(partner): rich overview dashboard with premium stats, context card, quick actions"
```

---

## Task 5: Partner Details Tab (Edit Form)

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/details/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/details/loading.tsx`

The new details form extends the existing `partner-edit-form.tsx` with the new profile fields (description, website, contact email, notes), auto-save for text areas, and a three-card layout.

- [ ] **Step 1: Create the server page**

Create `src/app/(dashboard)/partners/[slug]/details/page.tsx`:

```typescript
import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerDetailsForm } from "./partner-details-form";

export default async function PartnerDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug, { includeArchived: true }),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  return <PartnerDetailsForm partner={partner} />;
}
```

- [ ] **Step 2: Create the details form component**

Create `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`. This is based on the existing `partner-edit-form.tsx` but reorganised into three cards with the new fields. The form is roughly 280 lines — follow the existing edit form's patterns exactly (slugify, SaveState, useUnsavedChanges, handleSubmit, handleDelete) but add:

- A "Profile" card: name, slug, description (auto-save), website, contact email
- A "Notes" card: notes textarea (auto-save)
- A "Danger Zone" card: active toggle, archive button

For auto-save fields (description, notes), use `useAutoSave` if it exists in the codebase, or implement blur + 3s debounce with inline "Saving..." / "Saved" indicators. Check `src/hooks/use-auto-save.ts` for existing patterns.

The Zone 2 save button covers: name, slug, website, contactEmail. Description and notes save independently on blur.

Key differences from the existing form:
- `max-w-3xl` instead of `max-w-2xl`
- Three cards instead of one
- New fields: description, website, contactEmail, notes
- Auto-save for description and notes
- Hidden inputs for `description`, `website`, `contactEmail`, `notes` in the form

Redirect on slug change: `router.replace(\`/partners/${result.slug}/details\`, { scroll: false })`

- [ ] **Step 3: Create loading state**

Create `src/app/(dashboard)/partners/[slug]/details/loading.tsx`:

```typescript
export default function PartnerDetailsLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="h-64 rounded-xl bg-muted/40 animate-shimmer" />
      <div className="h-32 rounded-xl bg-muted/40 animate-shimmer" />
      <div className="h-24 rounded-xl bg-muted/40 animate-shimmer" />
    </div>
  );
}
```

- [ ] **Step 4: Verify build and test navigation**

Run: `pnpm build --filter=. 2>&1 | tail -20`
Navigate to `/partners/[slug]/details` — form should render with all fields.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/partners/[slug]/details/
git commit -m "feat(partner): details tab with profile fields, auto-save, and danger zone"
```

---

## Task 6: Partner Clients Tab

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/clients/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/clients/partner-clients-table.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/clients/loading.tsx`
- Modify: `src/app/actions/partners.ts` (add getPartnerClients, assignClientToPartner, unassignClientFromPartner)

- [ ] **Step 1: Add server actions**

In `src/app/actions/partners.ts`, add:

```typescript
export async function getPartnerClients(partnerId: string) {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  const { data, error } = await db
    .from('clients')
    .select('*, campaigns(count), client_assessment_assignments(count)')
    .eq('partner_id', partnerId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    throwActionError('getPartnerClients', 'Unable to load partner clients.', error)
  }

  return (data ?? []).map((row) => ({
    ...mapClientRow(row),
    campaignCount: row.campaigns ? ((row.campaigns as { count: number }[])[0]?.count ?? 0) : 0,
    assessmentCount: row.client_assessment_assignments
      ? ((row.client_assessment_assignments as { count: number }[])[0]?.count ?? 0) : 0,
  }))
}

export async function assignClientToPartner(clientId: string, partnerId: string) {
  const scope = await requireAdminScope()
  if (!canManagePartnerDirectory(scope)) {
    return { error: 'You do not have permission to assign clients.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ partner_id: partnerId })
    .eq('id', clientId)
    .is('partner_id', null) // only assign unassigned clients

  if (error) {
    logActionError('assignClientToPartner', error)
    return { error: 'Unable to assign client.' }
  }

  revalidateDirectoryPaths()
  return { success: true as const }
}

export async function unassignClientFromPartner(clientId: string) {
  const scope = await requireAdminScope()
  if (!canManagePartnerDirectory(scope)) {
    return { error: 'You do not have permission to unassign clients.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ partner_id: null })
    .eq('id', clientId)

  if (error) {
    logActionError('unassignClientFromPartner', error)
    return { error: 'Unable to unassign client.' }
  }

  revalidateDirectoryPaths()
  return { success: true as const }
}
```

You'll need to add `mapClientRow` import from `@/lib/supabase/mappers` at the top of the file.

- [ ] **Step 2: Create the DataTable component**

Create `src/app/(dashboard)/partners/[slug]/clients/partner-clients-table.tsx` as a `"use client"` component. Follow the `client-directory-table.tsx` pattern.

Columns: Client (DataTableRowLink → `/clients/[slug]/overview`), Industry, Size, Campaigns, Assessments, Status (badge), Actions (DataTableActionsMenu with Open, Unassign).

Searchable: `["name"]`. Filterable: status.

Include an "Assign Client" button that opens a dialog. The dialog should:
- Fetch unassigned clients via a new `getUnassignedClients()` action (or pass them as a prop)
- Show a searchable list
- Call `assignClientToPartner(clientId, partnerId)` on select
- Toast on success, refresh

- [ ] **Step 3: Create the server page**

Create `src/app/(dashboard)/partners/[slug]/clients/page.tsx`:

```typescript
import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug, getPartnerClients } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerClientsTable } from "./partner-clients-table";

export default async function PartnerClientsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  const clients = await getPartnerClients(partner.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Clients</h2>
        <p className="text-caption mt-0.5">
          {clients.length} client{clients.length !== 1 ? "s" : ""} in this partner&apos;s portfolio.
        </p>
      </div>
      <PartnerClientsTable
        clients={clients}
        partnerId={partner.id}
        isPlatformAdmin={scope.isPlatformAdmin}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create loading state**

```typescript
import { DataTableLoading } from "@/components/data-table/data-table-loading";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-5 w-20 rounded bg-muted/40 animate-shimmer" />
        <div className="h-4 w-48 rounded bg-muted/40 animate-shimmer mt-1" />
      </div>
      <DataTableLoading columnCount={7} filterCount={1} />
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/partners/[slug]/clients/ src/app/actions/partners.ts
git commit -m "feat(partner): clients tab with DataTable, assign/unassign functionality"
```

---

## Task 7: Partner Assessments Tab (DataTable)

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/assessments/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/assessments/partner-assessment-assignments.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/assessments/loading.tsx`

- [ ] **Step 1: Create the DataTable component**

Create `partner-assessment-assignments.tsx` as a `"use client"` component. Uses `DataTable` with these columns:

| Column | Accessor | Render |
|--------|----------|--------|
| Assessment | `assessmentName` | Bold text |
| Quota | `quotaLimit` | "Unlimited" or `{quotaUsed} / {quotaLimit}`, tabular-nums |
| Usage | `quotaUsed` | Mini progress bar (quotaUsed/quotaLimit) for limited, "{used} used" for unlimited |
| Status | computed | Amber badge "<10% remaining" when `quotaLimit - quotaUsed < quotaLimit * 0.1`, green "Healthy" otherwise |
| Assigned | `created_at` | Relative date with tooltip |
| Actions | — | DataTableActionsMenu: Edit Quota, Remove |

Include:
- "Assign Assessment" button (top right) that opens a dialog with assessment picker + quota input (matching `assessment-assignments.tsx` dialog pattern)
- Inline quota editing triggered via the "Edit Quota" action: sets `editingId` state, renders an Input in the Quota cell, saves on Enter/blur
- Confirm dialog for Remove that calls `removePartnerAssessmentAssignment`

Data props: `assignments: PartnerAssessmentAssignmentWithUsage[]`, `allAssessments: AssessmentWithMeta[]`, `partnerId: string`

Server actions: `assignAssessmentToPartner`, `updatePartnerAssessmentAssignment`, `removePartnerAssessmentAssignment` from `@/app/actions/partner-entitlements`

Searchable: `["assessmentName"]`

- [ ] **Step 2: Create the server page**

```typescript
import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import { getPartnerAssessmentAssignments } from "@/app/actions/partner-entitlements";
import { getAssessments } from "@/app/actions/assessments";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerAssessmentAssignments } from "./partner-assessment-assignments";

export default async function PartnerAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  const [assignments, allAssessments] = await Promise.all([
    getPartnerAssessmentAssignments(partner.id),
    getAssessments(),
  ]);

  // Filter to active assessments only
  const activeAssessments = allAssessments.filter((a) => a.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Assessment Assignments</h2>
        <p className="text-caption mt-0.5">
          Manage which assessments this partner can deploy to their clients.
        </p>
      </div>
      <PartnerAssessmentAssignments
        assignments={assignments}
        allAssessments={activeAssessments}
        partnerId={partner.id}
      />
    </div>
  );
}

- [ ] **Step 3: Create loading state**

```typescript
import { DataTableLoading } from "@/components/data-table/data-table-loading";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-5 w-48 rounded bg-muted/40 animate-shimmer" />
        <div className="h-4 w-64 rounded bg-muted/40 animate-shimmer mt-1" />
      </div>
      <DataTableLoading columnCount={6} filterCount={1} />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/partners/[slug]/assessments/
git commit -m "feat(partner): assessments tab with DataTable, quota management, assign dialog"
```

---

## Task 8: Partner Reports Tab (DataTable)

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/reports/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/reports/partner-report-assignments.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/reports/loading.tsx`

- [ ] **Step 1: Create the DataTable component**

Create `partner-report-assignments.tsx`. Columns:

| Column | Accessor | Render |
|--------|----------|--------|
| Template | `name` | Primary text + `description` truncated below in muted |
| Type | `reportType` | Badge: "Self-Report" or "360" |
| Level | `displayLevel` | Plain text: "Dimension" / "Factor" / "Construct" |
| Source | `partnerId` | "Platform" if null, "Partner" if set |
| Assigned | computed | Toggle switch (Zone 1 immediate) |

The toggle calls `togglePartnerReportTemplateAssignment(partnerId, templateId, newState)` with optimistic UI and toast.

Data props: `templates: ReportTemplate[]`, `assignments: PartnerReportTemplateAssignment[]`, `partnerId: string`

Filterable: type (self_report/360), assigned (yes/no). Searchable: `["name"]`.

- [ ] **Step 2: Create server page and loading state**

Same pattern as Task 7 but for report templates. Fetch via `getPartnerReportTemplateAssignments(partnerId)` and load all templates via whatever report template listing action exists (check `src/app/actions/` for report template actions).

- [ ] **Step 3: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/partners/[slug]/reports/
git commit -m "feat(partner): reports tab with DataTable and toggle assignments"
```

---

## Task 9: Partner Library Tab

**Files:**
- Create: `src/app/actions/partner-taxonomy.ts`
- Create: `src/app/(dashboard)/partners/[slug]/library/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/library/library-tabs.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/library/library-dimensions-table.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/library/library-factors-table.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/library/library-constructs-table.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/library/loading.tsx`

- [ ] **Step 1: Create server actions**

Create `src/app/actions/partner-taxonomy.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePartnerAccess } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import { revalidatePath } from 'next/cache'

type EntityType = 'dimension' | 'factor' | 'construct'

const TABLE_MAP: Record<EntityType, string> = {
  dimension: 'dimensions',
  factor: 'factors',
  construct: 'constructs',
}

export async function getPartnerTaxonomyAssignments(
  partnerId: string,
  entityType: EntityType,
) {
  await requirePartnerAccess(partnerId)
  const db = await createClient()
  const tableName = TABLE_MAP[entityType]

  // Get all active entities of this type
  let query
  // Note: always filter both is_active AND deleted_at to match existing codebase patterns
  if (entityType === 'dimension') {
    query = db.from(tableName).select('id, name, slug').eq('is_active', true).is('deleted_at', null).order('name')
  } else if (entityType === 'factor') {
    query = db.from(tableName).select('id, name, slug, dimension_id, dimensions(name)').eq('is_active', true).is('deleted_at', null).order('name')
  } else {
    // constructs — join through factor_constructs to get factor and dimension names
    query = db.from(tableName).select('id, name, slug, factor_constructs(factors(id, name, dimensions(name)))').eq('is_active', true).is('deleted_at', null).order('name')
  }

  const { data: entities, error: entitiesError } = await query

  if (entitiesError) {
    throwActionError('getPartnerTaxonomyAssignments', 'Unable to load taxonomy entities.', entitiesError)
  }

  // Get assignments for this partner + entity type
  const { data: assignments, error: assignError } = await db
    .from('partner_taxonomy_assignments')
    .select('entity_id')
    .eq('partner_id', partnerId)
    .eq('entity_type', entityType)
    .eq('is_active', true)

  if (assignError) {
    throwActionError('getPartnerTaxonomyAssignments', 'Unable to load assignments.', assignError)
  }

  const assignedIds = new Set((assignments ?? []).map((a) => a.entity_id))

  return (entities ?? []).map((entity: any) => {
    // For factors, extract dimension name from join
    const dimensionName = entity.dimensions?.name ?? undefined
    // For constructs, extract factor and dimension names from factor_constructs join
    const fc = entity.factor_constructs?.[0]
    const factor = Array.isArray(fc?.factors) ? fc.factors[0] : fc?.factors
    const factorName = factor?.name ?? undefined
    const constructDimensionName = factor?.dimensions?.name ?? dimensionName ?? undefined

    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      dimensionName: constructDimensionName,
      factorName,
      assigned: assignedIds.has(entity.id),
    }
  })
}

export async function togglePartnerTaxonomyAssignment(
  partnerId: string,
  entityType: EntityType,
  entityId: string,
  assigned: boolean,
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can manage taxonomy assignments.' }
  }
  if (!scope.actor?.id) {
    return { error: 'Unable to determine the acting user.' }
  }

  const db = createAdminClient()

  if (assigned) {
    const { error } = await db
      .from('partner_taxonomy_assignments')
      .upsert(
        {
          partner_id: partnerId,
          entity_type: entityType,
          entity_id: entityId,
          is_active: true,
          assigned_by: scope.actor.id,
        },
        { onConflict: 'partner_id,entity_type,entity_id' },
      )

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('partner_taxonomy_assignments')
      .update({ is_active: false })
      .eq('partner_id', partnerId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)

    if (error) return { error: error.message }
  }

  revalidatePath('/partners')
  return { success: true }
}

export async function bulkTogglePartnerTaxonomyAssignments(
  partnerId: string,
  entityType: EntityType,
  entityIds: string[],
  assigned: boolean,
): Promise<{ success: true } | { error: string }> {
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can manage taxonomy assignments.' }
  }
  if (!scope.actor?.id) {
    return { error: 'Unable to determine the acting user.' }
  }
  if (entityIds.length === 0) return { success: true }

  const db = createAdminClient()

  if (assigned) {
    const rows = entityIds.map((entityId) => ({
      partner_id: partnerId,
      entity_type: entityType,
      entity_id: entityId,
      is_active: true,
      assigned_by: scope.actor!.id,
    }))

    const { error } = await db
      .from('partner_taxonomy_assignments')
      .upsert(rows, { onConflict: 'partner_id,entity_type,entity_id' })

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('partner_taxonomy_assignments')
      .update({ is_active: false })
      .eq('partner_id', partnerId)
      .eq('entity_type', entityType)
      .in('entity_id', entityIds)

    if (error) return { error: error.message }
  }

  revalidatePath('/partners')
  return { success: true }
}
```

- [ ] **Step 2: Create the library page with sub-tabs**

Create `src/app/(dashboard)/partners/[slug]/library/page.tsx`. This is a server component that fetches all three entity types and passes them to a client wrapper with pill-style sub-tabs:

```typescript
import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { getPartnerTaxonomyAssignments } from "@/app/actions/partner-taxonomy";
import { LibraryTabs } from "./library-tabs";

export default async function PartnerLibraryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  const [dimensions, factors, constructs] = await Promise.all([
    getPartnerTaxonomyAssignments(partner.id, "dimension"),
    getPartnerTaxonomyAssignments(partner.id, "factor"),
    getPartnerTaxonomyAssignments(partner.id, "construct"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Library</h2>
        <p className="text-caption mt-0.5">
          Manage which taxonomy entities this partner can use to build assessments.
        </p>
      </div>
      <LibraryTabs
        partnerId={partner.id}
        dimensions={dimensions}
        factors={factors}
        constructs={constructs}
        isPlatformAdmin={scope.isPlatformAdmin}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create LibraryTabs client component**

Create `src/app/(dashboard)/partners/[slug]/library/library-tabs.tsx` as a `"use client"` component that manages the active sub-tab (Dimensions/Factors/Constructs) via `useState`. Renders pill-style buttons and conditionally shows the corresponding DataTable.

- [ ] **Step 4: Create the three DataTable components**

Each table (`library-dimensions-table.tsx`, `library-factors-table.tsx`, `library-constructs-table.tsx`) follows the same pattern:

- Checkbox column for multi-select
- Entity name column (searchable)
- Parent name columns (sortable, filterable) — factors have dimensionName, constructs have factorName + dimensionName
- Child count columns where applicable
- Toggle switch column that calls `togglePartnerTaxonomyAssignment`
- Bulk action toolbar: "Enable Selected" / "Disable Selected" buttons that call `bulkTogglePartnerTaxonomyAssignments`

For read-only mode (partner admins), hide the toggle and checkbox columns.

- [ ] **Step 5: Create loading state**

```typescript
import { DataTableLoading } from "@/components/data-table/data-table-loading";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-5 w-16 rounded bg-muted/40 animate-shimmer" />
        <div className="h-4 w-80 rounded bg-muted/40 animate-shimmer mt-1" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded-full bg-muted/40 animate-shimmer" />
        <div className="h-8 w-20 rounded-full bg-muted/40 animate-shimmer" />
        <div className="h-8 w-24 rounded-full bg-muted/40 animate-shimmer" />
      </div>
      <DataTableLoading columnCount={5} filterCount={1} />
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/partner-taxonomy.ts src/app/(dashboard)/partners/[slug]/library/
git commit -m "feat(partner): library tab with dimensions, factors, constructs DataTables and bulk operations"
```

---

## Task 10: Client Overview — Rich Dashboard

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/overview/page.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/overview/client-overview.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/overview/client-stats.tsx`

Mirror the partner overview pattern: premium stat cards, key context card, quick actions, recent campaigns. Remove the edit form embed.

- [ ] **Step 1: Rewrite client stats with premium styling**

Follow the same TiltCard + ScrollReveal + AnimatedNumber pattern as Task 4's partner stats.

Client stat cards: Active Campaigns, Participants, Assessments Assigned, Reports Generated (per spec).

- [ ] **Step 2: Rewrite client overview component**

Same layout as partner overview: stats + Key Context (showing industry, size, partner link, description, created date) + Quick Actions (View Campaigns, Manage Assessments, Enter Portal, Invite User) + Recent Campaigns.

Remove the `children` prop (no more edit form).

- [ ] **Step 3: Update the server page**

Remove the `ClientEditForm` import and rendering. Add a recent campaigns fetch — create a `getRecentClientCampaigns(clientId)` action in `src/app/actions/clients.ts` following the same pattern as `getRecentPartnerCampaigns` from Task 4, but filtering by `client_id` directly instead of through partner's clients.

- [ ] **Step 4: Create client overview loading.tsx**

Create `src/app/(dashboard)/clients/[slug]/overview/loading.tsx` matching the dashboard layout skeleton (same pattern as the partner overview loading from Task 4 Step 5).

- [ ] **Step 5: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/clients/[slug]/overview/ src/app/actions/clients.ts
git commit -m "feat(client): rich overview dashboard with premium stats, context card, quick actions"
```

---

## Task 11: Client Details Tab (Edit Form)

**Files:**
- Create: `src/app/(dashboard)/clients/[slug]/details/page.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/details/client-details-form.tsx`
- Create: `src/app/(dashboard)/clients/[slug]/details/loading.tsx`

Move `client-edit-form.tsx` content to the new details route. Same three-card layout as partner details, with client-specific fields (industry, sizeRange, partner ownership).

- [ ] **Step 1: Create server page**

Fetch client, partner options (if platform admin), and scope. Pass to `ClientDetailsForm`.

- [ ] **Step 2: Create details form**

Based on `client-edit-form.tsx` but reorganised into Profile / Notes / Danger Zone cards. Same `max-w-3xl` constraint.

Redirect on slug change: `router.replace(\`/clients/${result.slug}/details\`, { scroll: false })`

- [ ] **Step 3: Create loading state**

Same shimmer pattern as partner details.

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/clients/[slug]/details/
git commit -m "feat(client): details tab with profile fields and auto-save"
```

---

## Task 12: Client Assessments — Convert to DataTable

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/assessments/assessment-assignments.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/assessments/page.tsx`

Convert the card-based assessment assignment UI to a DataTable matching the partner assessments tab pattern.

- [ ] **Step 1: Rewrite assessment-assignments.tsx**

Replace the card-based layout with a DataTable. Same columns as Task 7 (Assessment, Quota, Usage, Status, Assigned, Actions). Same inline edit and assign dialog patterns.

**Key difference:** When the client belongs to a partner, the assessment picker only shows assessments from the partner's pool. The page.tsx should fetch partner assessment IDs and pass them to filter the picker.

- [ ] **Step 2: Update page.tsx to pass partner pool data**

If the client has a `partnerId`, fetch `getPartnerAssessmentAssignments(partnerId)` and pass the available assessment IDs to the component so the picker filters correctly.

- [ ] **Step 3: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/clients/[slug]/assessments/
git commit -m "feat(client): convert assessment assignments to DataTable with partner pool filter"
```

---

## Task 13: Client Reports — Convert to DataTable

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/reports/report-assignments.tsx`

Convert the checkbox/card-based report template UI to a DataTable matching the partner reports tab pattern.

- [ ] **Step 1: Rewrite report-assignments.tsx**

Replace with a DataTable. Same columns as Task 8 (Template, Type, Level, Source, Assigned toggle).

- [ ] **Step 2: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/clients/[slug]/reports/
git commit -m "feat(client): convert report assignments to DataTable with toggle"
```

---

## Task 14: Client Entitlements — Partner Cascade Guards

**Files:**
- Modify: `src/app/actions/client-entitlements.ts`
- Modify: `src/app/(dashboard)/clients/[slug]/settings/client-settings-panel.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/settings/page.tsx`

This completes Tasks 4-5 from the partner entitlements plan.

- [ ] **Step 1: Verify isClientBrandingEnabled helper exists**

This function may already exist in `src/app/actions/client-entitlements.ts` (around line 430). If so, verify it matches this implementation. If not, add it:

```typescript
export async function isClientBrandingEnabled(clientId: string): Promise<boolean> {
  const db = await createClient()
  const { data: client } = await db
    .from('clients')
    .select('can_customize_branding, partner_id')
    .eq('id', clientId)
    .single()

  if (!client?.can_customize_branding) return false

  if (client.partner_id) {
    const { data: partner } = await db
      .from('partners')
      .select('can_customize_branding')
      .eq('id', client.partner_id)
      .single()

    if (!partner?.can_customize_branding) return false
  }

  return true
}
```

- [ ] **Step 2: Add partner pool guard on assignAssessment**

In the existing `assignAssessment` function, after auth check but before INSERT, add the partner pool guard (check if client's partner has this assessment assigned).

- [ ] **Step 3: Extend checkQuotaAvailability with partner-level check**

After the client quota check loop, add a partner-level check using `get_partner_assessment_quota_usage` RPC.

- [ ] **Step 4: Update client settings for partner cascade**

In `client-settings-panel.tsx`, accept a `partnerBrandingDisabled: boolean` prop. When true, render the branding toggle as disabled with helper text: "Brand customisation is controlled by the partner."

Update `page.tsx` to fetch the partner's branding flag and pass it.

- [ ] **Step 5: Verify build and test**

Run: `pnpm build --filter=. 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/client-entitlements.ts src/app/(dashboard)/clients/[slug]/settings/
git commit -m "feat(partner): add partner pool guard, quota cascade, and branding cascade"
```

---

## Task 15: Cleanup — Remove Dead Routes

**Files:**
- Delete: `src/app/(dashboard)/partners/[slug]/edit/page.tsx`
- Delete: `src/app/(dashboard)/partners/[slug]/edit/partner-edit-form.tsx`
- Delete: `src/app/(dashboard)/clients/[slug]/overview/client-edit-form.tsx`

- [ ] **Step 1: Delete the old partner edit route**

```bash
rm src/app/(dashboard)/partners/[slug]/edit/page.tsx
rm src/app/(dashboard)/partners/[slug]/edit/partner-edit-form.tsx
rmdir src/app/(dashboard)/partners/[slug]/edit/
```

- [ ] **Step 2: Delete the old client edit form from overview**

```bash
rm src/app/(dashboard)/clients/[slug]/overview/client-edit-form.tsx
```

- [ ] **Step 3: Check for any remaining imports**

Search for `partner-edit-form` and `client-edit-form` references across the codebase and remove them.

Run: `grep -r "partner-edit-form\|client-edit-form" src/` — should return no results.

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter=. 2>&1 | tail -20`
Expected: Clean build with no broken imports

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): remove dead edit routes, overview edit form imports"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 2: Run tests**

Run: `pnpm test` (or `npm run test:unit`)
Expected: All tests pass

- [ ] **Step 3: Visual verification checklist**

Start dev server: `pnpm dev`

**Partner admin:**
1. `/partners/[slug]/overview` — premium stats, key context card, quick actions, recent campaigns
2. `/partners/[slug]/details` — edit form with profile fields, auto-save description/notes
3. `/partners/[slug]/clients` — DataTable with assign/unassign
4. `/partners/[slug]/assessments` — DataTable with quota management
5. `/partners/[slug]/reports` — DataTable with toggle assignments
6. `/partners/[slug]/library` — sub-tabs, DataTables, bulk operations
7. All tabs use `max-w-6xl` width consistently

**Client admin:**
8. `/clients/[slug]/overview` — premium stats, key context card, quick actions
9. `/clients/[slug]/details` — edit form with industry/size/partner
10. `/clients/[slug]/assessments` — DataTable (converted from cards)
11. `/clients/[slug]/reports` — DataTable (converted from cards)
12. Partner cascade: disable partner branding → client toggle disabled

**Both:**
13. Dark mode renders correctly
14. Loading skeletons match layout
15. Toasts fire on all mutations
16. Empty states show consistently
