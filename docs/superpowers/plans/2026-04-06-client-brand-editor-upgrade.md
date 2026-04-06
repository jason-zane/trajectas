# Client Brand Editor Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the client brand editor from a single colour picker to a full editor (identity, colours, surfaces, typography, shape) and add a client portal settings route so client admins can edit their own brand.

**Architecture:** Reuses all components built for the campaign brand editor (LogoUploader, ColorPicker, FontSelector, RadiusSelector, PreviewGallery). The `ClientBrandEditor` component is upgraded in-place and rendered in two contexts: admin route (`/clients/[slug]/branding`) and client portal route (`/settings/brand/client`). Brand actions are widened to accept client admin callers.

**Tech Stack:** Next.js App Router, React, Supabase, Zod, OKLCH colour pipeline

**Spec:** `docs/superpowers/specs/2026-04-06-client-brand-editor-design.md`

---

### Task 1: Widen Brand Actions Auth

**Files:**
- Modify: `src/app/actions/brand.ts`

This is the critical foundation — without this, client portal admins can't save brand configs.

- [ ] **Step 1: Read the current file**

Read `src/app/actions/brand.ts` to understand the current auth pattern. Key lines:
- Line 124: `const scope = await requireAdminScope()` in `upsertBrandConfig`
- Line 187: `const scope = await requireAdminScope()` in `resetBrandToDefault`

Both throw for non-platform-admin users. We need to allow client admins when `ownerType === 'client'`.

- [ ] **Step 2: Update `upsertBrandConfig` auth**

Replace line 124:
```typescript
const scope = await requireAdminScope()
```

With:
```typescript
const scope = await resolveAuthorizedScope()
if (ownerType === 'client' && ownerId) {
  if (!canManageClient(scope, ownerId)) {
    throw new AuthorizationError('Not authorized to manage this client')
  }
} else {
  assertAdminOnly(scope)
}
```

Add imports at the top of the file (alongside existing auth imports):
```typescript
import { resolveAuthorizedScope, canManageClient, assertAdminOnly, AuthorizationError } from '@/lib/auth/authorization'
```

Remove `requireAdminScope` from imports if it's no longer used elsewhere in this file. Check if `resetBrandToDefault` also uses it — if so, keep the import until step 3.

- [ ] **Step 3: Update `resetBrandToDefault` auth**

Replace line 187 (approximately, after step 2 may have shifted lines):
```typescript
const scope = await requireAdminScope()
```

With the same pattern:
```typescript
const scope = await resolveAuthorizedScope()
if (ownerType === 'client' && ownerId) {
  if (!canManageClient(scope, ownerId)) {
    throw new AuthorizationError('Not authorized to manage this client')
  }
} else {
  assertAdminOnly(scope)
}
```

Now remove `requireAdminScope` from imports if no longer used in the file.

- [ ] **Step 4: Add revalidation for client portal route**

Find the `revalidatePath` calls in both functions. After the existing `revalidatePath('/clients')` calls (lines ~159 and ~204), add:
```typescript
revalidatePath('/settings/brand/client')
```

- [ ] **Step 5: Verify types and tests**

Run: `npx tsc --noEmit`
Expected: Clean compilation

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/brand.ts
git commit -m "feat(brand): widen auth on brand actions for client admin callers"
```

---

### Task 2: Update Client Branding Server Page

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/branding/page.tsx`

Update the server component to pass `inheritedBrand` (platform default) and `clientId` separately, matching the campaign editor's two-prop pattern.

- [ ] **Step 1: Read the current file**

Read `src/app/(dashboard)/clients/[slug]/branding/page.tsx`. Currently it:
- Loads client via `getClientBySlug`
- Calls `getEffectiveBrandRecord("client", client.id)` which conflates client config with platform fallback
- Passes `client` and `initialRecord` to `ClientBrandEditor`

- [ ] **Step 2: Update to separate client-specific record from inherited brand**

Replace the page body with:

```typescript
import { notFound } from "next/navigation"
import { getClientBySlug } from "@/app/actions/clients"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import { ClientBrandEditor } from "./client-brand-editor"
import type { BrandConfig } from "@/lib/brand/types"

export default async function ClientBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const client = await getClientBySlug(slug)
  if (!client) notFound()

  // Load client-specific brand record (null if none saved)
  const clientRecord = await getBrandConfig("client", client.id)

  // Load platform default as the inherited brand
  const platformRecord = await getPlatformBrand()
  const inheritedBrand: BrandConfig = platformRecord?.config ?? (TALENT_FIT_DEFAULTS as BrandConfig)

  return (
    <ClientBrandEditor
      clientId={client.id}
      clientName={client.name}
      initialRecord={clientRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
```

Note: `getBrandConfig("client", client.id)` returns the client-specific record only — it returns `null` when no config exists for that owner (no fallback). This is the same function the campaign branding page uses at `src/app/(dashboard)/campaigns/[id]/branding/page.tsx`.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
This may fail because `ClientBrandEditor` props have changed — that's expected, Task 3 fixes it.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/clients/[slug]/branding/page.tsx
git commit -m "feat(brand): update client branding page to pass inherited brand separately"
```

---

### Task 3: Upgrade Client Brand Editor Component

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx`

**Reference:** `src/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor.tsx` for the pattern to follow. The client editor should look very similar but with typography and shape sections added.

This is the main task. The editor goes from ~145 lines with one colour picker to a full editor with identity, colours, surfaces, typography, shape, and live previews.

- [ ] **Step 1: Read current file and campaign editor for reference**

Read both files:
- `src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx` (current, to be replaced)
- `src/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor.tsx` (reference pattern)

- [ ] **Step 2: Rewrite the client brand editor**

Replace the entire file content. The new component should:

**Props interface:**
```typescript
interface ClientBrandEditorProps {
  clientId: string
  clientName: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}
```

**Imports** (match campaign editor, plus font/radius/shape additions):
```typescript
"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { cn } from "@/lib/utils"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { LogoUploader } from "@/components/brand-editor/logo-uploader"
import { FontSelector } from "@/components/brand-editor/font-selector"
import { RadiusSelector } from "@/components/brand-editor/radius-selector"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { upsertBrandConfig } from "@/app/actions/brand"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import { HEADING_BODY_FONTS, buildGoogleFontsUrl } from "@/lib/brand/fonts"
import type { BrandConfig, BrandConfigRecord, NeutralTemperature, BorderRadiusPreset } from "@/lib/brand/types"
```

**Component body** follows the campaign editor structure closely:

1. **State initialisation** — `initialRecord?.config ?? { ...inheritedBrand }` for config, with `cloneConfig` deep-clone (JSON parse/stringify) to avoid reference leaks from defaults.

2. **Google Fonts `useEffect`** — inject `<link>` tag for selected heading/body fonts (copy pattern from platform editor lines 65-81).

3. **`update` helper** — `useCallback((partial) => setConfig(prev => ({ ...prev, ...partial })))`.

4. **`handleSave`** — calls `upsertBrandConfig("client", clientId, config)` with toast feedback.

5. **`neutralOptions`** constant — `[{ value: "warm", label: "Warm" }, ...]`.

6. **Layout** — same split panel as campaign editor:
   - Left panel (w-[400px] shrink-0): control cards stacked vertically
   - Right panel (flex-1, sticky top-6): PreviewGallery

7. **Control cards** (left panel, in order):
   - **Inherited context card** — shows "Inherits from TalentFit (platform default)" with Building2 icon
   - **Identity card** — Display name `<Input>` + `<LogoUploader ownerType="client" ownerId={clientId}>`
   - **Colors card** — Primary + Accent `<ColorPicker>`
   - **Surfaces card** — Temperature toggle + Background picker + Card picker (same JSX as campaign editor)
   - **Typography card** — Heading `<FontSelector>` + Body `<FontSelector>` using `HEADING_BODY_FONTS`
   - **Shape card** — `<RadiusSelector>` + Dark mode `<Switch>`
   - **Save button**

8. **Preview** (right panel):
   ```typescript
   <PreviewGallery
     config={config}
     surfaces={["dashboard", "questions", "report"]}
     brandName={config.name}
     logoUrl={config.logoUrl}
   />
   ```

9. **Unsaved changes dialog** — same as campaign editor.

**Key differences from campaign editor:**
- No custom-enable toggle. The client editor always saves a config. No `resetBrandToDefault` — clients don't toggle custom branding on/off (the admin controls that via the entitlement toggle on the settings page).
- Adds Typography and Shape sections (campaign editor doesn't have these). Reference the platform editor (`src/app/(dashboard)/settings/brand/brand-editor.tsx` lines 424-493) for the `FontSelector` and `RadiusSelector` usage pattern.
- No `PageHeader` — the editor is rendered within a tab layout (admin view) or settings layout (client portal) which provides its own heading context. The campaign editor doesn't use one either.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx
git commit -m "feat(brand): upgrade client brand editor to full controls with live preview"
```

---

### Task 4: Client Portal Brand Settings Route

**Files:**
- Create: `src/app/(dashboard)/settings/brand/client/page.tsx`
- Create: `src/app/(dashboard)/settings/brand/client/loading.tsx`

- [ ] **Step 1: Create the server page**

```typescript
import { redirect, notFound } from "next/navigation"
import { resolveAuthorizedScope, canManageClient } from "@/lib/auth/authorization"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import { ClientBrandEditor } from "@/app/(dashboard)/clients/[slug]/branding/client-brand-editor"
import type { BrandConfig } from "@/lib/brand/types"

export default async function ClientPortalBrandPage() {
  const scope = await resolveAuthorizedScope()

  // Resolve which client this user belongs to
  const clientId = scope.activeContext?.tenantType === "client"
    ? scope.activeContext.tenantId
    : scope.clientIds[0]

  if (!clientId) redirect("/dashboard")

  // Auth check — only client admins
  if (!canManageClient(scope, clientId)) redirect("/dashboard")

  // Load the client record to check entitlement and get name
  const { createAdminClient } = await import("@/lib/supabase/admin")
  const db = createAdminClient()
  const { data: client } = await db
    .from("clients")
    .select("id, name, can_customize_branding")
    .eq("id", clientId)
    .single()

  if (!client) notFound()

  // If branding not enabled, show disabled message
  if (!client.can_customize_branding) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <svg className="size-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            Brand customisation is not enabled
          </h2>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to enable brand customisation for your organisation.
          </p>
        </div>
      </div>
    )
  }

  // Load brand config
  const clientRecord = await getBrandConfig("client", clientId)
  const platformRecord = await getPlatformBrand()
  const inheritedBrand: BrandConfig = platformRecord?.config ?? (TALENT_FIT_DEFAULTS as BrandConfig)

  return (
    <ClientBrandEditor
      clientId={client.id}
      clientName={client.name}
      initialRecord={clientRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
```

Note: The import of `ClientBrandEditor` uses a cross-route import (`@/app/(dashboard)/clients/[slug]/branding/client-brand-editor`). This works in Next.js but if it causes issues, the component can be moved to `src/components/brand-editor/client-brand-editor.tsx`. Use judgment during implementation.

Note: `getBrandConfig` returns the owner-specific record only (null if none saved) — same pattern as the campaign branding page.

- [ ] **Step 2: Create the loading state**

```typescript
export default function ClientBrandLoading() {
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

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/brand/client/
git commit -m "feat(brand): add client portal brand settings route"
```

---

### Task 5: Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/app-sidebar.tsx`. Key locations:
- Lines 159-171: `clientNav` constant
- Lines 173-182: `settingsNav` constant
- Lines 184-188: `navByPortal` map
- Line 196: `isSettingsArea` check
- Line 197: `displayNav` conditional
- Lines 232-242: "Back to..." button (admin only)
- Lines 299-314: "Platform Settings" footer button (admin only)

- [ ] **Step 2: Add `clientSettingsNav` constant**

After `settingsNav` (after line 182), add:

```typescript
const clientSettingsNav: NavSection[] = [
  {
    label: "Settings",
    items: [
      { title: "Brand", href: "/settings/brand/client", icon: Palette },
    ],
  },
]
```

Ensure `Palette` is imported from `lucide-react` (check if it's already in the imports — if not, add it).

- [ ] **Step 3: Update `displayNav` conditional**

Replace line 197:
```typescript
const displayNav = isSettingsArea && portal === "admin" ? settingsNav : navSections;
```

With:
```typescript
const displayNav = isSettingsArea
  ? portal === "admin"
    ? settingsNav
    : portal === "client"
      ? clientSettingsNav
      : navSections
  : navSections;
```

- [ ] **Step 4: Update "Back to..." button condition**

Replace the condition at line 232 (approximately):
```typescript
{isSettingsArea && portal === "admin" && (
```

With:
```typescript
{isSettingsArea && (portal === "admin" || portal === "client") && (
```

Also update the "Back to..." link text to be portal-aware. If it currently says "Back to platform", change it to:
```typescript
{portal === "admin" ? "Back to platform" : "Back to dashboard"}
```

And the `href` should be `"/"` for admin, `"/dashboard"` for client (matching `clientNav`'s overview href).

- [ ] **Step 5: Add settings footer button for client portal**

Find the "Platform Settings" footer button block (lines 299-314). After it (or modify the condition), add a client equivalent:

```typescript
{portal === "client" && !isSettingsArea && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")}>
      <Link href="/settings/brand/client">
        <Palette />
        <span>Brand Settings</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 7: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(brand): add client portal settings navigation with brand link"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 2: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 3: Visual verification**

Start dev server: `npm run dev`

Verify admin view:
1. Navigate to `/clients/[slug]/branding` — full editor with Identity, Colors, Surfaces, Typography, Shape
2. Live previews show Dashboard, Questions, Report
3. Change display name → preview headers update
4. Change primary colour → buttons/progress update
5. Change neutral temperature → backgrounds shift
6. Upload logo → preview headers show it
7. Change font → preview text updates
8. Change border radius → preview corners update
9. Save + reload → all settings persist

Verify client portal:
10. Enable `can_customize_branding` on a client in Settings
11. Switch to client portal
12. "Brand Settings" appears in sidebar footer
13. Click it → navigates to `/settings/brand/client`
14. Same full editor renders with all controls
15. Save works (client admin auth passes)
16. Disable `can_customize_branding` → shows disabled message

Verify inheritance:
17. Campaign editor shows "Inherits branding from [Client Name]"
18. Campaign picks up client brand colours/fonts
