# Client Brand Editor — Upgrade & Client Portal Access

## Context

The client (organisation) brand editor at `/clients/[slug]/branding` currently only exposes a single primary colour picker. Campaigns inherit from this client brand, so it's the foundation of the brand hierarchy. It should offer the same level of control as the campaign brand editor we just built, plus typography and shape controls.

Additionally, when `can_customize_branding` is enabled on a client, the client's own admin users have no way to access a brand editor — there's no settings section in the client portal. This spec adds that route.

## Design Decisions

- **Same editor component in both contexts** — the admin at `/clients/[slug]/branding` and the client admin at `/settings/brand` render the same `ClientBrandEditor`. No subset or restricted view.
- **Controls**: Identity (name + logo), Colors (primary + accent), Surfaces (temperature + background + card), Typography (heading + body font), Shape (border radius + dark mode).
- **Preview surfaces**: Dashboard, Questions (runner), Report — the three contexts where client brand appears.
- **Save pattern**: Zone 2 (explicit save), matching the campaign editor.
- **No schema changes** — `BrandConfig` already has all fields, `brand_configs` already supports `owner_type = 'client'`.

---

## 1. Upgrade Client Brand Editor Component

### Current state

`src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx` is a simple component with:
- Single `ColorPicker` for primary colour
- Compact `PreviewGallery` (runner only)
- Zone 2 save with `useUnsavedChanges`

### New state

Replace the single colour picker with a full editor matching the campaign editor pattern. The component keeps the same interface (`ClientBrandEditorProps`) but the body expands to include:

#### Control sections (left panel, scrollable):

1. **Inherited context card** — shows "Inherits from Trajectas (platform default)" (same pattern as campaign editor's inherited context card)

2. **Identity section** — Display name input + `LogoUploader` (reuse existing component, `ownerType="client"`, `ownerId={clientId}`)

3. **Colors section** — Primary + Accent `ColorPicker`s (same as campaign editor)

4. **Surfaces section** — Neutral temperature segmented toggle (Warm/Neutral/Cool), Page Background picker with "Use neutral temperature instead" reset, Card Background picker with "Reset to white" reset (same as campaign editor)

5. **Typography section** — Heading font `FontSelector` + Body font `FontSelector` (reuse from platform editor, imports from `src/components/brand-editor/font-selector.tsx`)

6. **Shape section** — `RadiusSelector` for border radius + Dark mode `Switch` toggle (reuse from platform editor, imports from `src/components/brand-editor/radius-selector.tsx`)

7. **Save button** — same three-state pattern ("Save Changes" → "Saving..." → "Saved")

#### Preview (right panel, sticky):

`PreviewGallery` with:
- `surfaces={["dashboard", "questions", "report"]}`
- `brandName={config.name}` and `logoUrl={config.logoUrl}` for live binding
- Light/Dark/Mobile toggle (already built into gallery)

#### Imports to add

- `LogoUploader` from `@/components/brand-editor/logo-uploader`
- `FontSelector` from `@/components/brand-editor/font-selector`
- `RadiusSelector` from `@/components/brand-editor/radius-selector`
- `NeutralTemperature`, `BorderRadiusPreset` from `@/lib/brand/types`
- `HEADING_BODY_FONTS`, `buildGoogleFontsUrl` from `@/lib/brand/fonts`
- `cn` from `@/lib/utils`

#### Google Fonts injection

Same pattern as the platform editor — `useEffect` that injects a `<link>` tag for the selected heading and body fonts so the preview renders with actual fonts.

---

## 2. Client Portal Settings Route

### New route: `src/app/(dashboard)/settings/brand/client/page.tsx`

Server component that:
1. Calls `resolveAuthorizedScope()` to get the user's scope
2. Resolves the active client ID from `scope.activeContext.tenantId` (when `tenantType === 'client'`). If no active client context, redirect to the dashboard.
3. Checks `canManageClient(scope, clientId)` — only client admins can access. Regular members get redirected.
4. Loads the full `Client` record by ID (need `getClientById` or equivalent query) — required for the editor's `client` prop and to check `can_customize_branding`.
5. If `can_customize_branding` is disabled: renders a centered card with an icon, "Brand customisation is not enabled" heading in `text-foreground`, and "Contact your administrator to enable brand customisation for your organisation." body in `text-muted-foreground`. No editor rendered.
6. If enabled: loads the client's brand config via `getEffectiveBrandRecord("client", clientId)` **and** the platform default via `getPlatformBrand()` separately (so we can distinguish "client has saved config" from "inheriting defaults"). Renders `ClientBrandEditor` with both.

### Loading state: `src/app/(dashboard)/settings/brand/client/loading.tsx`

Shimmer skeleton matching the editor layout (left controls + right preview).

### Why `/settings/brand/client/` and not `/settings/brand/`?

The `/settings/brand/` route already exists and renders the platform brand editor. Adding `/settings/brand/client/` as a sub-route keeps both accessible. The sidebar navigation handles which one to link to based on portal context.

---

## 2b. Brand Actions Auth Widening

### File: `src/app/actions/brand.ts`

Both `upsertBrandConfig` and `resetBrandToDefault` currently call `requireAdminScope()` which only allows platform admins. Client portal admins will be blocked.

**Change:** When `ownerType === 'client'`, use `canManageClient(scope, ownerId)` instead of `requireAdminScope()`. This allows both platform admins and client admins to save brand configs for their client. For `ownerType === 'platform'` or `'campaign'`, keep the existing `requireAdminScope()` check.

**Additional revalidation:** When saving a client brand config, also revalidate `/settings/brand/client` so the client portal page reflects saved changes.

---

## 3. Sidebar Navigation

### File: `src/components/app-sidebar.tsx`

#### Add client settings nav

Add a `clientSettingsNav` constant alongside the existing `settingsNav`:

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

#### Update display logic

The existing logic swaps to `settingsNav` when `isSettingsArea && portal === "admin"`. Extend this:

- `isSettingsArea && portal === "admin"` → show `settingsNav`
- `isSettingsArea && portal === "client"` → show `clientSettingsNav`
- Otherwise → show portal's regular nav

#### Add settings link to client portal

The client portal sidebar (`clientNav`) currently has "Overview" and "Assessments". Add a footer-area "Settings" link (matching how the admin portal has a "Platform Settings" footer button) that navigates to `/settings/brand/client`.

Update the "Back to..." button condition to include client portal so the settings area has a way back to the main client nav.

---

## Files to Create

| File | Purpose |
|---|---|
| `src/app/(dashboard)/settings/brand/client/page.tsx` | Client portal brand settings route |
| `src/app/(dashboard)/settings/brand/client/loading.tsx` | Shimmer loading state |

## Files to Modify

| File | Changes |
|---|---|
| `src/app/(dashboard)/clients/[slug]/branding/client-brand-editor.tsx` | Upgrade from single colour picker to full editor (identity, colours, surfaces, typography, shape, live previews). Props: `clientId`, `clientName`, `initialRecord` (client-specific, nullable), `inheritedBrand` (platform default). Use `cloneConfig` deep-clone pattern from the platform editor for safe default handling. No custom-enable toggle — the client editor always saves a config. |
| `src/app/(dashboard)/clients/[slug]/branding/page.tsx` | Update to pass `clientId`, `initialRecord` (client-specific brand config or null), and `inheritedBrand` (platform default) as separate props |
| `src/app/actions/brand.ts` | Widen auth on `upsertBrandConfig` and `resetBrandToDefault` to allow client admins via `canManageClient()` when `ownerType === 'client'`. Add revalidation for `/settings/brand/client`. |
| `src/components/app-sidebar.tsx` | Add `clientSettingsNav`, update display logic for client portal settings area, add settings link to client nav |

## Files NOT Changed

- `src/components/brand-editor/logo-uploader.tsx` — already built, accepts `ownerType`/`ownerId`
- `src/components/brand-editor/preview-gallery.tsx` — already supports all needed surfaces and props
- `src/components/brand-editor/preview-questions.tsx`, `preview-complete.tsx`, `preview-welcome.tsx` — already built
- `src/components/brand-editor/font-selector.tsx`, `radius-selector.tsx` — already exist in platform editor
- `src/lib/brand/tokens.ts` — already generates all tokens from full BrandConfig
- `src/lib/brand/types.ts` — already has all fields
- `brand_configs` table — no schema changes

## Verification

1. `npm run test:unit` — existing tests pass
2. `npx tsc --noEmit` — clean compilation
3. **Admin view**: navigate to `/clients/[slug]/branding` — full editor with all six control sections, live previews (dashboard, questions, report)
4. **Client portal view**: enable `can_customize_branding`, switch to client portal, navigate to Settings > Brand — same editor, same controls
5. **Client portal disabled**: disable `can_customize_branding`, verify Settings > Brand shows disabled message
6. **Inheritance**: campaign editor shows "Inherits branding from [Client Name]" and picks up the client brand
7. **Save/load**: save client brand, reload, verify all settings persist
8. **Preview binding**: change name → preview headers update, change colour → preview buttons update, change temperature → preview backgrounds shift, upload logo → preview headers show it
