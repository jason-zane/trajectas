# Partner Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add partner-level branding — editor, portal route, and brand hierarchy update (platform → partner → client → campaign).

**Architecture:** Migration adds `'partner'` to the `brand_owner_type` enum. New `canManagePartner` auth helper and `resolvePartnerOrg` resolution helper. Brand actions widened for partner auth and hierarchy resolution. `PartnerBrandEditor` component mirrors `ClientBrandEditor`. Admin and portal routes follow established patterns. Client branding pages updated to inherit via partner.

**Tech Stack:** Next.js App Router, React, Supabase, OKLCH colour pipeline

**Spec:** `docs/superpowers/specs/2026-04-07-partner-branding-design.md`

---

### Task 1: Schema, Types & Auth Foundation

**Files:**
- Create: `supabase/migrations/00075_partner_brand_owner_type.sql`
- Modify: `src/lib/brand/types.ts`
- Modify: `src/lib/validations/brand.ts`
- Modify: `src/lib/auth/authorization.ts`
- Create: `src/lib/auth/resolve-partner-org.ts`

This task lays the foundation — everything else depends on it.

- [ ] **Step 1: Create migration**

```sql
-- Add 'partner' to brand_owner_type enum
ALTER TYPE brand_owner_type ADD VALUE IF NOT EXISTS 'partner';
```

- [ ] **Step 2: Update BrandOwnerType**

In `src/lib/brand/types.ts` line 14, change:
```typescript
export type BrandOwnerType = 'platform' | 'client' | 'campaign'
```
to:
```typescript
export type BrandOwnerType = 'platform' | 'partner' | 'client' | 'campaign'
```

- [ ] **Step 3: Update validation schema**

In `src/lib/validations/brand.ts` line 59, the `upsertBrandConfigSchema` has:
```typescript
ownerType: z.enum(['platform', 'client']),
```
Change to:
```typescript
ownerType: z.enum(['platform', 'partner', 'client', 'campaign']),
```

- [ ] **Step 4: Add `canManagePartner` to authorization**

In `src/lib/auth/authorization.ts`, after `canManageClient` (around line 365), add:

```typescript
export function canManagePartner(scope: AuthorizedScope, partnerId: string) {
  return scope.isPlatformAdmin || scope.partnerAdminIds.includes(partnerId)
}
```

- [ ] **Step 5: Create `resolvePartnerOrg` helper**

Create `src/lib/auth/resolve-partner-org.ts` mirroring `src/lib/auth/resolve-client-org.ts`. Read that file first, then create the partner version:

The helper should:
1. Call `resolveAuthorizedScope()`
2. Check `scope.activeContext?.tenantType === 'partner'` → use `scope.activeContext.tenantId`
3. Fall back to `scope.partnerIds[0]` if no active context
4. Return `{ partnerId: string }` or redirect to `/partner` if no partner found

Follow the exact patterns in `resolve-client-org.ts` — the three-tier fallback (active context → first membership → platform admin), redirect on failure.

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 7: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/00075_partner_brand_owner_type.sql src/lib/brand/types.ts src/lib/validations/brand.ts src/lib/auth/authorization.ts src/lib/auth/resolve-partner-org.ts
git commit -m "feat(partner): add partner brand type, auth helper, and resolution helper"
```

---

### Task 2: Brand Hierarchy & Auth Widening

**Files:**
- Modify: `src/app/actions/brand.ts`

Update the brand resolution and auth for partner support.

- [ ] **Step 1: Read the current file**

Read `src/app/actions/brand.ts`. Key sections:
- `getEffectiveBrand` (lines 81-103): currently platform → client → campaign
- `getEffectiveBrandRecord` (lines 108-122): has client fallback only
- `upsertBrandConfig` auth (lines 137-143): client case + admin fallback
- `resetBrandToDefault` auth (lines 210-216): same pattern

- [ ] **Step 2: Update `getEffectiveBrand` to include partner**

The function currently does:
```typescript
// Try org-specific
if (clientId) {
  const orgBrand = await getBrandConfig('client', clientId)
  if (orgBrand) return orgBrand.config
}
```

Replace with:
```typescript
// Try client-specific
if (clientId) {
  const orgBrand = await getBrandConfig('client', clientId)
  if (orgBrand) return orgBrand.config

  // Try partner-specific (if client belongs to a partner)
  const db = await createClient()
  const { data: clientRow } = await db
    .from('clients')
    .select('partner_id')
    .eq('id', clientId)
    .single()

  if (clientRow?.partner_id) {
    const partnerBrand = await getBrandConfig('partner', clientRow.partner_id)
    if (partnerBrand) return partnerBrand.config
  }
}
```

- [ ] **Step 3: Update `getEffectiveBrandRecord` to include partner**

The function currently has:
```typescript
if (ownerType === 'client') {
  return getPlatformBrand()
}
```

Change to:
```typescript
if (ownerType === 'client' && ownerId) {
  // Try partner brand if client has a partner
  const db = await createClient()
  const { data: clientRow } = await db
    .from('clients')
    .select('partner_id')
    .eq('id', ownerId)
    .single()

  if (clientRow?.partner_id) {
    const partnerBrand = await getBrandConfig('partner', clientRow.partner_id)
    if (partnerBrand) return partnerBrand
  }

  return getPlatformBrand()
}

if (ownerType === 'partner') {
  return getPlatformBrand()
}
```

- [ ] **Step 4: Widen auth in `upsertBrandConfig`**

Replace the auth section (lines 137-143):
```typescript
if (ownerType === 'client' && ownerId) {
  if (!canManageClient(scope, ownerId)) {
    throw new AuthorizationError('Not authorized to manage this client')
  }
} else {
  assertAdminOnly(scope)
}
```

With:
```typescript
if (ownerType === 'client' && ownerId) {
  if (!canManageClient(scope, ownerId)) {
    throw new AuthorizationError('Not authorized to manage this client')
  }
} else if (ownerType === 'partner' && ownerId) {
  if (!canManagePartner(scope, ownerId)) {
    throw new AuthorizationError('Not authorized to manage this partner')
  }
} else {
  assertAdminOnly(scope)
}
```

Add import for `canManagePartner` from `@/lib/auth/authorization`.

- [ ] **Step 5: Same auth change in `resetBrandToDefault`**

Replace the equivalent auth section (lines 210-216) with the same three-branch pattern.

- [ ] **Step 6: Add revalidation paths**

In `upsertBrandConfig`, after existing revalidation calls, add:
```typescript
if (ownerType === 'partner') {
  revalidatePath('/partners')
  revalidatePath('/partner/settings/brand')
}
```

Same in `resetBrandToDefault`.

- [ ] **Step 7: Add partner to audit metadata**

In the `logAuditEvent` call in `upsertBrandConfig`, add `partnerId: ownerId` when `ownerType === 'partner'` (matching how `clientId` is set for client).

- [ ] **Step 8: Verify and commit**

Run: `npx tsc --noEmit && npm run test:unit`

```bash
git add src/app/actions/brand.ts
git commit -m "feat(partner): add partner to brand hierarchy and widen auth"
```

---

### Task 3: Partner Brand Editor Component

**Files:**
- Create: `src/app/(dashboard)/partners/[slug]/branding/partner-brand-editor.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/branding/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/branding/loading.tsx`

**Reference:** Mirror `src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx` exactly, changing `client` → `partner`.

- [ ] **Step 1: Read the client brand editor**

Read `src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx` thoroughly — it's the exact template.

- [ ] **Step 2: Create the partner brand editor**

Create `src/app/(dashboard)/partners/[slug]/branding/partner-brand-editor.tsx` by mirroring the client editor:

**Props:**
```typescript
interface PartnerBrandEditorProps {
  partnerId: string
  partnerName: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}
```

**Key changes from client:**
- All `clientId` → `partnerId`, `clientName` → `partnerName`
- `upsertBrandConfig("partner", partnerId, config)` instead of `"client"`
- `ownerType="partner"` on LogoUploader
- Same six control sections: Identity, Colors, Surfaces, Typography, Shape
- Same preview: `surfaces={["dashboard", "questions", "report"]}` with `brandName`/`logoUrl`
- Same save pattern, same unsaved changes dialog
- Inherited context card shows "Inherits from Trajectas (platform default)"

- [ ] **Step 3: Create the admin server page**

Create `src/app/(dashboard)/partners/[slug]/branding/page.tsx`:

```typescript
import { notFound } from "next/navigation"
import { getPartnerBySlug } from "@/app/actions/partners"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { PartnerBrandEditor } from "./partner-brand-editor"
import type { BrandConfig } from "@/lib/brand/types"

export default async function PartnerBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const partner = await getPartnerBySlug(slug)
  if (!partner) notFound()

  const [partnerRecord, platformRecord] = await Promise.all([
    getBrandConfig("partner", partner.id),
    getPlatformBrand(),
  ])

  const inheritedBrand: BrandConfig =
    platformRecord?.config ?? (TRAJECTAS_DEFAULTS as BrandConfig)

  return (
    <PartnerBrandEditor
      partnerId={partner.id}
      partnerName={partner.name}
      initialRecord={partnerRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
```

- [ ] **Step 4: Create loading state**

```typescript
export default function PartnerBrandingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex gap-8 items-start">
        <div className="w-[400px] shrink-0 space-y-6">
          <div className="h-20 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-48 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-40 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-52 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-36 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-32 rounded-xl bg-muted/40 animate-shimmer" />
        </div>
        <div className="flex-1 min-w-0 space-y-4">
          <div className="h-8 w-32 rounded-lg bg-muted/40 animate-shimmer" />
          <div className="h-72 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-64 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-56 rounded-xl bg-muted/40 animate-shimmer" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && npm run test:unit`

```bash
git add src/app/(dashboard)/partners/[slug]/branding/
git commit -m "feat(partner): add partner brand editor and admin branding page"
```

---

### Task 4: Partner Portal Brand Settings Route

**Files:**
- Create: `src/app/partner/settings/brand/page.tsx`
- Create: `src/app/partner/settings/brand/loading.tsx`

**Reference:** Mirror `src/app/client/settings/brand/client/page.tsx` for partner.

- [ ] **Step 1: Read the client portal brand page**

Read `src/app/client/settings/brand/client/page.tsx` — it's the template.

- [ ] **Step 2: Create the partner portal brand page**

Create `src/app/partner/settings/brand/page.tsx`:

Pattern:
1. Call `resolvePartnerOrg("/partner/settings/brand")` and `resolveAuthorizedScope()` in parallel
2. If no partnerId, redirect to `/partner`
3. Check `canManagePartner(scope, partnerId)` — redirect if not authorised
4. Load partner record (id, name, can_customize_branding) via admin client
5. If `!can_customize_branding`: show disabled message with `Building2` icon (same pattern as client portal)
6. If enabled: load brand config + platform default, render `PartnerBrandEditor`

Import `PartnerBrandEditor` from `@/app/(dashboard)/partners/[slug]/branding/partner-brand-editor`.

- [ ] **Step 3: Create loading state**

Same shimmer skeleton as Task 3 Step 4.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npm run test:unit`

```bash
git add src/app/partner/settings/brand/
git commit -m "feat(partner): add partner portal brand settings route"
```

---

### Task 5: Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/app-sidebar.tsx`. Key locations:
- Lines 184-189: `clientSettingsNav` constant
- Lines 206-212: `displayNav` conditional
- Lines 330-345: client portal footer button

- [ ] **Step 2: Add `partnerSettingsNav`**

After `clientSettingsNav` (line 189), add:

```typescript
const partnerSettingsNav: NavSection[] = [
  {
    label: "Settings",
    items: [{ title: "Brand", href: "/settings/brand", icon: Palette }],
  },
]
```

- [ ] **Step 3: Update `displayNav` logic**

Replace the current conditional (lines 206-212):
```typescript
const displayNav = isSettingsArea
  ? portal === "admin"
    ? settingsNav
    : portal === "client"
      ? clientSettingsNav
      : navSections
  : navSections;
```

With:
```typescript
const displayNav = isSettingsArea
  ? portal === "admin"
    ? settingsNav
    : portal === "client"
      ? clientSettingsNav
      : portal === "partner"
        ? partnerSettingsNav
        : navSections
  : navSections;
```

- [ ] **Step 4: Add partner portal footer button**

After the client portal footer button block (after line 345), add the partner equivalent:

```typescript
{portal === "partner" && !isSettingsArea && (
  <SidebarFooter className="px-3 pb-3">
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isSettingsArea}
          tooltip="Brand Settings"
          render={<Link href={href("/settings/brand")} />}
        >
          <Palette className="size-4" />
          <span>Brand Settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
)}
```

- [ ] **Step 5: Update "Back to..." button**

Find the back button condition. It should already include `portal === "client"` from the client work. Add `portal === "partner"`:

```typescript
{isSettingsArea && (portal === "admin" || portal === "client" || portal === "partner") && (
```

And make the link text and href portal-aware:
```typescript
href={portal === "admin" ? "/" : portal === "client" ? href("/dashboard") : href("/")}
```
```typescript
{portal === "admin" ? "Back to platform" : portal === "client" ? "Back to dashboard" : "Back to dashboard"}
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npm run test:unit`

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(partner): add partner portal brand settings navigation"
```

---

### Task 6: Client Inheritance via Partner

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/branding/page.tsx`
- Modify: `src/app/client/settings/brand/client/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/branding/page.tsx`

Update these pages so the inherited brand resolves through the partner when applicable.

- [ ] **Step 1: Update admin client branding page**

Read `src/app/(dashboard)/clients/[slug]/branding/page.tsx`. Currently it resolves `inheritedBrand` from `getPlatformBrand()` only. Update to check partner first:

After loading the client, add:
```typescript
// Resolve inherited brand: partner → platform
let inheritedBrand: BrandConfig = TRAJECTAS_DEFAULTS as BrandConfig

if (client.partnerId) {
  const partnerBrand = await getBrandConfig("partner", client.partnerId)
  if (partnerBrand) {
    inheritedBrand = partnerBrand.config
  } else {
    const platform = await getPlatformBrand()
    if (platform) inheritedBrand = platform.config
  }
} else {
  const platform = await getPlatformBrand()
  if (platform) inheritedBrand = platform.config
}
```

Replace the existing `inheritedBrand` resolution with this.

- [ ] **Step 2: Update client portal brand page**

Read `src/app/client/settings/brand/client/page.tsx`. It has the same pattern — `inheritedBrand` resolved from `getPlatformBrand()` only. Apply the same partner-first resolution:

After loading the client record, look up `partner_id` and resolve:
```typescript
let inheritedBrand: BrandConfig = TRAJECTAS_DEFAULTS as BrandConfig

// Check partner brand first, then platform
const partnerIdForBrand = client.partner_id ?? null
if (partnerIdForBrand) {
  const partnerBrand = await getBrandConfig("partner", partnerIdForBrand)
  if (partnerBrand) {
    inheritedBrand = partnerBrand.config
  }
}
if (inheritedBrand === TRAJECTAS_DEFAULTS) {
  const platform = await getPlatformBrand()
  if (platform) inheritedBrand = platform.config
}
```

Note: The client portal page loads the client via an admin DB query (not via `getClientBySlug`), so `partner_id` may need to be added to the select fields.

- [ ] **Step 3: Update campaign branding page "Inherits from" display**

Read `src/app/(dashboard)/campaigns/[id]/branding/page.tsx`. It passes `clientName` or "Trajectas (platform default)" as the inheritance source. Update to also check for partner:

If the client has a partner and the client has no saved brand, the source should show the partner name. If the partner also has no saved brand, show "Trajectas (platform default)".

This requires loading the client's `partnerId` and the partner record. Add:
```typescript
let inheritedFrom = "Trajectas (platform default)"
if (clientBrand) {
  inheritedFrom = clientName
} else if (client.partnerId) {
  const partnerBrand = await getBrandConfig("partner", client.partnerId)
  if (partnerBrand) {
    // Load partner name
    const partner = await getPartnerById(client.partnerId) // or inline query
    inheritedFrom = partner?.name ?? "Partner"
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npm run test:unit`

```bash
git add src/app/(dashboard)/clients/[slug]/branding/page.tsx src/app/client/settings/brand/client/page.tsx src/app/(dashboard)/campaigns/[id]/branding/page.tsx
git commit -m "feat(partner): resolve inherited brand through partner in client and campaign pages"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Type check and tests**

Run: `npx tsc --noEmit && npm run test:unit`

- [ ] **Step 2: Push migration**

Run: `npm run db:push`

- [ ] **Step 3: Visual verification**

Start dev server: `npm run dev`

**Admin partner branding:**
1. Navigate to `/partners/[slug]/branding` → full editor with all six sections
2. Change colours, upload logo, change fonts → live preview updates
3. Save → reload → settings persist

**Partner portal:**
4. Enable `can_customize_branding` on a partner
5. Switch to partner portal → "Brand Settings" in sidebar footer
6. Click → renders full brand editor at `/partner/settings/brand`
7. Save works (partner admin auth passes)
8. Disable `can_customize_branding` → shows disabled message

**Hierarchy:**
9. Save a partner brand (e.g. change primary to blue)
10. Navigate to a client under that partner → branding page
11. "Inherits from" shows the partner name
12. Client inherits the blue primary (visible in preview)
13. Create a campaign under that client → "Inherits from" shows correct source
14. Campaign preview shows blue inherited from partner chain
