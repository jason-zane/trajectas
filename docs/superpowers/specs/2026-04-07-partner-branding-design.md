# Partner Branding — Editor, Portal Route & Brand Hierarchy

## Context

Partners currently have no brand editing capability. The brand hierarchy is platform → client → campaign. This spec adds the partner level (platform → partner → client → campaign), an admin-facing brand editor at `/partners/[slug]/branding`, and a partner portal settings route so partner admins can edit their own brand when `can_customize_branding` is enabled.

Follows the exact pattern built for clients: same editor controls, same preview surfaces, same save pattern. The `can_customize_branding` flag and entitlement system were added in the partner entitlements work.

## Design Decisions

- **Mirror the client brand editor exactly** — same controls (Identity, Colors, Surfaces, Typography, Shape), same preview surfaces (Dashboard, Questions, Report), same Zone 2 save pattern.
- **Partner sits between platform and client in the hierarchy** — clients belonging to a partner inherit from the partner's brand (not directly from platform). Campaigns inherit from their client, which may inherit from the partner.
- **Same component in admin and portal contexts** — `PartnerBrandEditor` is rendered at both `/partners/[slug]/branding` (admin) and `/partner/settings/brand` (partner portal).

---

## 1. Schema & Type Changes

### 1a. Database enum

Add `'partner'` to the `brand_owner_type` enum:

```sql
ALTER TYPE brand_owner_type ADD VALUE IF NOT EXISTS 'partner';
```

### 1b. TypeScript type

Update `BrandOwnerType` in `src/lib/brand/types.ts` (line 14) to include `'partner'`:

```typescript
export type BrandOwnerType = 'platform' | 'partner' | 'client' | 'campaign'
```

### 1c. Validation

Update the `upsertBrandConfigSchema` in `src/lib/validations/brand.ts` — the `ownerType` field currently restricts to `z.enum(['platform', 'client'])`. Add `'partner'` (and `'campaign'` if missing):

```typescript
ownerType: z.enum(['platform', 'partner', 'client', 'campaign'])
```

### 1d. Auth helper

Create `canManagePartner` in `src/lib/auth/authorization.ts` — does not exist today:

```typescript
export function canManagePartner(scope: AuthorizedScope, partnerId: string) {
  return scope.isPlatformAdmin || scope.partnerAdminIds.includes(partnerId)
}
```

---

## 2. Brand Hierarchy Update

### File: `src/app/actions/brand.ts`

#### 2a. `getEffectiveBrand` resolution order

Update to: platform → **partner** → client → campaign.

When resolving effective brand for a client:
1. Check for client-specific brand config
2. If none, check for the client's partner brand config (if client has `partner_id`)
3. If none, fall back to platform default

When resolving effective brand for a campaign:
1. Check for campaign-specific brand config
2. If none, resolve via the client (which may cascade to partner → platform)

The function signature stays the same — `(clientId?, campaignId?)`. It internally looks up `clients.partner_id` when a `clientId` is provided and no client-specific brand exists, then tries the partner brand before falling to platform. No call-site changes needed.

Also update `getEffectiveBrandRecord` (same file) — it has the same resolution logic and needs the same partner fallback case.

#### 2b. Auth widening for partner owner type

In `upsertBrandConfig`, the auth check is currently:
```typescript
if (ownerType === 'client' && ownerId) { canManageClient... }
else { assertAdminOnly(scope) }
```

Insert partner as an `else if` BETWEEN the client check and the admin-only fallback:

```typescript
if (ownerType === 'client' && ownerId) {
  if (!canManageClient(scope, ownerId)) throw new AuthorizationError(...)
} else if (ownerType === 'partner' && ownerId) {
  if (!canManagePartner(scope, ownerId)) throw new AuthorizationError('Not authorized to manage this partner')
} else {
  assertAdminOnly(scope)
}
```

Import `canManagePartner` from `@/lib/auth/authorization`.

Same change in `resetBrandToDefault`.

Add revalidation for partner: `revalidatePath('/partner/settings/brand')` and `revalidatePath('/partners')` when `ownerType === 'partner'`.

Add `partnerId` to audit log metadata when `ownerType === 'partner'`.

#### 2c. Campaign editor "Inherits from" display

The campaign brand editor shows "Inherits branding from [source]". Update the campaign branding page's server component to resolve the inheritance source correctly: if the client has a partner with a saved brand, show the partner name; otherwise show the client name or platform default.

---

## 3. Partner Brand Editor Component

### File: `src/app/(dashboard)/partners/[slug]/branding/partner-brand-editor.tsx`

Mirror `src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx` exactly, changing `client` → `partner`.

**Props:**
```typescript
interface PartnerBrandEditorProps {
  partnerId: string
  partnerName: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}
```

**Controls** (same as client editor):
- Identity: display name + LogoUploader (`ownerType="partner"`)
- Colors: primary + accent
- Surfaces: temperature + background + card
- Typography: heading + body font
- Shape: border radius + dark mode

**Preview:** `surfaces={["dashboard", "questions", "report"]}` with live `brandName`/`logoUrl` binding.

**Save:** `upsertBrandConfig("partner", partnerId, config)` with Zone 2 pattern.

---

## 4. Admin-Facing Branding Page

### Files:
- Create: `src/app/(dashboard)/partners/[slug]/branding/page.tsx`
- Create: `src/app/(dashboard)/partners/[slug]/branding/loading.tsx`

Server component loads partner by slug, fetches partner-specific brand config (or null) and platform default as inherited brand. Same pattern as `/clients/[slug]/branding/page.tsx`.

---

## 5. Partner Portal Brand Settings Route

### Files:
- Create: `src/app/partner/settings/brand/page.tsx`
- Create: `src/app/partner/settings/brand/loading.tsx`

Server component — follows the same pattern as `src/app/client/settings/brand/client/page.tsx` but for partners:

1. Create a `resolvePartnerOrg` helper (`src/lib/auth/resolve-partner-org.ts`) mirroring `resolveClientOrg`. It resolves the partner ID from: `scope.activeContext.tenantId` (when `tenantType === 'partner'`), falling back to `scope.partnerIds[0]`. Returns `{ partnerId }`.
2. Call `resolvePartnerOrg()` and `resolveAuthorizedScope()` in parallel
3. Check `canManagePartner(scope, partnerId)` — partner admins only. Redirect to `/partner` if not authorised.
4. Load partner record by ID (name + `can_customize_branding`)
5. If `can_customize_branding` disabled: show "Brand customisation is not enabled" message (same pattern as client portal)
6. If enabled: load brand config via `getBrandConfig("partner", partnerId)` + platform default, render `PartnerBrandEditor`

---

## 6. Sidebar Navigation

### File: `src/components/app-sidebar.tsx`

Add `partnerSettingsNav` constant (same pattern as `clientSettingsNav`):

```typescript
const partnerSettingsNav: NavSection[] = [
  {
    label: "Settings",
    items: [
      { title: "Brand", href: "/settings/brand", icon: Palette },
    ],
  },
]
```

Update `displayNav` logic to handle partner portal settings area:
- `isSettingsArea && portal === "partner"` → show `partnerSettingsNav`

Add "Brand Settings" footer button for partner portal (same pattern as client portal footer button).

Update "Back to..." button to include partner portal.

---

## Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/00075_partner_brand_owner_type.sql` | Add 'partner' to brand_owner_type enum |
| `src/app/(dashboard)/partners/[slug]/branding/partner-brand-editor.tsx` | Full brand editor component |
| `src/app/(dashboard)/partners/[slug]/branding/page.tsx` | Admin branding page (server component) |
| `src/app/(dashboard)/partners/[slug]/branding/loading.tsx` | Shimmer loading state |
| `src/app/partner/settings/brand/page.tsx` | Partner portal brand settings route |
| `src/app/partner/settings/brand/loading.tsx` | Shimmer loading state |
| `src/lib/auth/resolve-partner-org.ts` | Partner resolution helper (mirrors `resolve-client-org.ts`) |

## Files to Modify

| File | Changes |
|---|---|
| `src/lib/brand/types.ts` | Add `'partner'` to `BrandOwnerType` |
| `src/lib/validations/brand.ts` | Add `'partner'` to `ownerType` enum in `upsertBrandConfigSchema` |
| `src/lib/auth/authorization.ts` | Add `canManagePartner` function |
| `src/app/actions/brand.ts` | Add partner to `getEffectiveBrand` + `getEffectiveBrandRecord` resolution, widen auth in `upsertBrandConfig` + `resetBrandToDefault` for partner admins, add revalidation paths + audit metadata |
| `src/components/app-sidebar.tsx` | Add `partnerSettingsNav`, update display logic, add footer button, update back button |
| `src/app/(dashboard)/campaigns/[id]/branding/page.tsx` | Update "Inherits from" to resolve partner name when applicable |
| `src/app/(dashboard)/clients/[slug]/branding/page.tsx` | Resolve inherited brand via partner when client has `partner_id` |
| `src/app/client/settings/brand/client/page.tsx` | Same inherited brand resolution via partner |

## Files NOT Changed

- `src/components/brand-editor/` — all components already built and reusable
- `src/lib/brand/tokens.ts` — already generates all tokens from full BrandConfig
- Partner detail shell — "Branding" tab already exists in the tabs array
- `src/app/actions/partner-entitlements.ts` — branding toggle already implemented
- Upload API route — already accepts any string as `ownerType`

## Verification

1. `npm run db:push` — migration applies
2. `npx tsc --noEmit` — clean
3. `npm run test:unit` — all pass
4. **Admin: partner branding** — full editor at `/partners/[slug]/branding`
5. **Partner portal** — Settings > Brand renders editor when enabled, disabled message when not
6. **Hierarchy** — client with partner inherits partner brand; campaign inherits via client
7. **Campaign editor** — "Inherits from" shows partner name when partner has saved brand
