# Campaign Brand Editor — Polish & Feature Additions

## Context

The campaign brand editor (`/campaigns/[id]/branding`) allows consultants to override inherited brand settings per campaign. Currently it exposes only primary/accent color pickers and a URL text input for logo. This spec covers three improvements:

1. **Surface controls** — add neutral temperature, page background, and card background overrides (matching the platform Surfaces tab pattern)
2. **Logo uploader** — replace the URL text input with a drag-and-drop file upload backed by Supabase Storage
3. **Live preview cards** — replace the current static mockups with three accurate, reactive preview cards (Welcome, Questions, Complete) that reflect the real assessment runner screens and update live as controls change

## Design Decisions

- **Scope**: campaign-level only. Platform brand editor is unchanged.
- **Inheritance**: all new fields inherit from org/platform brand. Campaign overrides are optional.
- **Save pattern**: Zone 2 (explicit save). All changes are local state until "Save Changes" is clicked.
- **Preview accuracy**: preview components must use the same CSS variable names as the real assessment runner pages, so what you see is what participants get.

---

## 1. Surface Controls

### What changes

Add a **Surfaces** section to the campaign brand editor controls panel, below the Colors section. Three controls, matching the platform Surfaces tab exactly:

#### 1a. Neutral Temperature

- Segmented button group: Warm / Neutral / Cool
- Maps to `config.neutralTemperature`
- Inherited value shown as default selection
- Controls `--brand-neutral-*` tokens (backgrounds, borders, muted text across all previews)

#### 1b. Page Background

- ColorPicker for `config.backgroundColor` (optional)
- When set, overrides the neutral-temperature-derived background
- "Use neutral temperature instead" link to clear the override
- Placeholder shows the current inherited/neutral-derived value

#### 1c. Card Background

- ColorPicker for `config.cardColor` (optional)
- When set, overrides default white card surfaces
- "Reset to white" link to clear the override

### Data flow

`BrandConfig` already has `neutralTemperature`, `backgroundColor`, and `cardColor` fields. The campaign editor currently doesn't expose them but they're stored and inherited. No schema changes needed — just UI additions.

### Token impact

When these values change, `generateCSSTokens()` already produces the correct `--brand-neutral-*` tokens. The preview gallery calls `generateCSSTokens(config)` with the full config, so changing temperature/background/card immediately cascades through all preview cards.

---

## 2. Logo Uploader

### What changes

Replace the current `<Input>` (URL text field) with a drag-and-drop upload component.

#### Upload component: `LogoUploader`

**Location**: `src/components/brand-editor/logo-uploader.tsx`

**Props**:
- `value?: string` — current logo URL (from `config.logoUrl`), used to show existing logo on mount
- `onChange: (url: string | undefined) => void` — called with the public URL after upload, or `undefined` on remove

**UI states**:
- **Empty**: dashed border dropzone, "Drop image or click to upload", accepts PNG/JPG, max 2MB
- **Uploading**: progress indicator replacing the dropzone content
- **Has logo**: shows the uploaded/existing image as a preview (object-contain, max height ~80px), with a "Remove" button
- **Error**: inline error message below the dropzone (e.g. "File too large", "Upload failed")

**Behaviour**:
- Accepts `image/png`, `image/jpeg` only (no SVG — avoids embedded script risks since logos may be rendered in emails/PDFs)
- Max file size: 2MB (validated client-side before upload)
- On drop/select: uploads to Supabase Storage via an API route, returns the public URL
- Calls `onChange(url)` with the public URL — the parent stores it in `config.logoUrl`
- On remove: calls `onChange(undefined)` — the parent clears `config.logoUrl`
- File deletion from storage is best-effort — orphaned files from unsaved sessions or replaced logos are acceptable since brand logos are small and infrequent. No cleanup mechanism needed for v1.

#### API route: `POST /api/brand-assets/upload`

**Location**: `src/app/api/brand-assets/upload/route.ts`

**Behaviour**:
- Accepts `multipart/form-data` with a single `file` field and an `ownerType` + `ownerId` field
- Validates: auth check (admin scope — only platform admins/consultants access campaign branding), file type (`image/png`, `image/jpeg`), file size (<=2MB)
- Sanitises filename (slugify, truncate) before storage
- Uploads to Supabase Storage bucket `brand-assets` with path: `{ownerType}/{ownerId}/{timestamp}-{sanitised-filename}`
- Returns `{ url: string }` — the public URL
- Uses the admin Supabase client (service role) for storage operations

#### Supabase Storage setup

- Bucket: `brand-assets` (public, since logos are served to participants via `<img>` tags)
- RLS: not needed for public buckets; the API route handles auth
- Migration: `supabase/migrations/00062_brand_assets_bucket.sql` — creates the bucket idempotently

---

## 3. Live Preview Cards

### What changes

Replace the current `PreviewRunner` and `PreviewEmail` mockups with three new preview components that accurately reflect the real assessment runner pages:

#### 3a. PreviewWelcome (modify existing)

**Matches**: `src/app/assess/[token]/welcome/page.tsx` + `WelcomeScreen` component

**Shows**:
- Header bar with logo (or fallback icon) + display name — reactive to identity controls
- Centered card with welcome icon, heading ("Welcome, Alex"), description text
- "Begin Assessment" CTA button in `--brand-primary`
- Footer with "Powered by TalentFit" or custom text
- Card background uses `--brand-neutral-50`, borders use `--brand-neutral-200`

#### 3b. PreviewQuestions (new file, replaces PreviewRunner in campaign context)

**Matches**: `src/app/assess/[token]/section/[sectionIndex]/page.tsx` + `SectionWrapper` component

**Shows**:
- Header bar with logo/name + back button
- Thin progress bar (2px): `--brand-neutral-200` track, `--brand-primary` fill at ~35%
- Assessment name eyebrow in `--brand-primary` (uppercase, tracking-widest) — reactive to display name
- Question stem in `--brand-text`
- Horizontal Likert options: unselected = `--brand-neutral-100` bg / `--brand-neutral-200` border, selected = `--brand-primary` bg
- Footer: save status dot + "Responses saved automatically"

#### 3c. PreviewComplete (new)

**Matches**: `src/app/assess/[token]/complete/page.tsx` + `CompleteScreen` component

**Shows**:
- Header bar with logo/name (same as welcome)
- Centered success icon (checkmark in `--brand-accent-*` circle)
- "Thank You" heading in `--brand-text`
- Completion message in `--brand-neutral-500`
- Footer

### Live binding rules

All three previews are wrapped by the `PreviewGallery` container which applies CSS tokens as inline styles. When controls change:

| Control changed | What updates in previews |
|---|---|
| Display name | Header brand name text + questions eyebrow label in all cards |
| Logo upload | Header logo image replaces fallback icon in all cards |
| Primary color | Buttons, progress bar, eyebrow text, selected likert option, icon accents |
| Accent color | Completion icon circle, decorative elements |
| Neutral temperature | Card backgrounds, borders, unselected likert buttons, muted text |
| Page background | Preview container outer background |
| Card color | All preview card surface backgrounds |

### PreviewGallery changes

**Type changes**: Expand `PreviewSurface` union to include the new surface names:
```typescript
type PreviewSurface = "runner" | "welcome" | "questions" | "complete" | "report" | "email" | "dashboard"
```

- `"runner"` is kept as an alias for backward compatibility — the platform editor still uses it. It maps to the same `PreviewQuestions` component in `SURFACE_COMPONENTS`.
- Update `SURFACE_LABELS` and `SURFACE_COMPONENTS` maps to include all new entries.

**Props**: Accept optional `brandName` and `logoUrl` props, pass through to preview components.
```typescript
interface PreviewGalleryProps {
  config: BrandConfig
  compact?: boolean
  surfaces?: PreviewSurface[]
  brandName?: string   // new — for live display name binding
  logoUrl?: string     // new — for live logo binding
}
```

- `SURFACE_COMPONENTS` type changes from `Record<PreviewSurface, React.FC>` to `Record<PreviewSurface, React.FC<PreviewCardProps>>` where `PreviewCardProps = { brandName?: string; logoUrl?: string }`.
- The campaign editor passes `config.name` and `config.logoUrl` so previews update live.
- Campaign editor uses `surfaces={["welcome", "questions", "complete"]}`.
- Platform editor continues to use the existing default (`["dashboard", "runner", "report", "email"]`) — unchanged.

---

## Files to Create

| File | Purpose |
|---|---|
| `src/components/brand-editor/logo-uploader.tsx` | Drag-and-drop logo upload component |
| `src/app/api/brand-assets/upload/route.ts` | Multipart upload API route |
| `src/components/brand-editor/preview-complete.tsx` | Completion page preview card |
| `src/components/brand-editor/preview-questions.tsx` | Questions page preview card (replaces PreviewRunner for campaign context) |
| `supabase/migrations/00062_brand_assets_bucket.sql` | Create `brand-assets` storage bucket |
| `src/app/(dashboard)/campaigns/[id]/branding/loading.tsx` | Shimmer loading state for branding route |

## Files to Modify

| File | Changes |
|---|---|
| `src/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor.tsx` | Add surfaces section, replace URL input with LogoUploader, pass brandName/logoUrl to PreviewGallery, update surfaces list |
| `src/components/brand-editor/preview-gallery.tsx` | Expand `PreviewSurface` type union, update `SURFACE_COMPONENTS` type to accept props, accept and pass through `brandName`/`logoUrl` |
| `src/components/brand-editor/preview-welcome.tsx` | Accept `brandName`/`logoUrl` props, use them for live header |

## Files NOT Changed

- `src/lib/brand/tokens.ts` — already generates all needed tokens from the full BrandConfig
- `src/lib/brand/types.ts` — already has all needed fields
- `src/app/actions/brand.ts` — already handles full BrandConfig upsert (logo URL is just a string in the config JSONB — no special storage handling needed)
- `src/components/brand-editor/preview-runner.tsx` — kept as-is for platform editor's `"runner"` surface. `PreviewQuestions` is a new component for the campaign editor.
- `src/components/brand-editor/preview-dashboard.tsx` — only shown in platform editor
- `src/components/brand-editor/preview-email.tsx` — only shown in platform editor
- `src/components/brand-editor/preview-report.tsx` — only shown in platform editor
- Real assessment runner pages — unchanged, they already consume brand tokens correctly

## Verification

1. `npm run test:unit` — existing tests pass
2. `npx tsc --noEmit` — clean compilation
3. Visual: changing primary color → buttons/progress/eyebrow update across all three preview cards
4. Visual: changing display name → header text + eyebrow update across all three cards
5. Visual: uploading logo → replaces fallback icon in all three card headers
6. Visual: changing neutral temperature → card backgrounds and borders shift across all three cards
7. Visual: changing page/card background → preview container and card surfaces update
8. Visual: light/dark/mobile toggle works correctly with all new controls
