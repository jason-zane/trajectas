# Campaign Brand Editor Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add surface controls, drag-and-drop logo upload, and live preview cards to the campaign brand editor.

**Architecture:** Extends the existing campaign brand editor with three new control sections (surfaces mirroring the platform Surfaces tab, logo uploader backed by Supabase Storage, and three live preview cards). All new components follow existing patterns — `ColorPicker` for colors, `PreviewGallery` for previews, admin Supabase client for storage. No schema changes needed.

**Tech Stack:** Next.js App Router, React, Supabase Storage, Zod validation, OKLCH color pipeline

**Spec:** `docs/superpowers/specs/2026-04-02-campaign-brand-editor-design.md`

---

### Task 1: Supabase Storage Bucket Migration

**Files:**
- Create: `supabase/migrations/00062_brand_assets_bucket.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Create brand-assets storage bucket for logo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Push migration**

Run: `npm run db:push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00062_brand_assets_bucket.sql
git commit -m "feat(brand): add brand-assets storage bucket migration"
```

---

### Task 2: Upload API Route

**Files:**
- Create: `src/app/api/brand-assets/upload/route.ts`

**Reference:** `src/app/api/reports/generate/route.ts` for admin client pattern, `src/lib/supabase/admin.ts` for `createAdminClient()`

- [ ] **Step 1: Create the upload route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminScope, AuthenticationRequiredError, AuthorizationError } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg'])

/** Sanitise filename: lowercase, strip non-alphanumeric, truncate. */
function sanitiseFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'png'
  const base = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${base || 'logo'}.${ext}`
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminScope()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ownerType = formData.get('ownerType') as string | null
    const ownerId = formData.get('ownerId') as string | null

    if (!file || !ownerType || !ownerId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, ownerType, ownerId' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'File must be PNG or JPEG' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File must be under 2MB' },
        { status: 400 }
      )
    }

    const db = createAdminClient()
    const filename = sanitiseFilename(file.name)
    const storagePath = `${ownerType}/${ownerId}/${Date.now()}-${filename}`

    const { error: uploadError } = await db.storage
      .from('brand-assets')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Brand asset upload failed:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      )
    }

    const { data: urlData } = db.storage
      .from('brand-assets')
      .getPublicUrl(storagePath)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Brand asset upload error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add src/app/api/brand-assets/upload/route.ts
git commit -m "feat(brand): add brand-assets upload API route"
```

---

### Task 3: LogoUploader Component

**Files:**
- Create: `src/components/brand-editor/logo-uploader.tsx`

**Reference:** The existing `ColorPicker` at `src/components/brand-editor/color-picker.tsx` for component style patterns. The campaign brand editor uses `Label` from `@/components/ui/label`.

- [ ] **Step 1: Create the LogoUploader component**

```typescript
"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, X, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"

interface LogoUploaderProps {
  label: string
  description?: string
  value?: string
  ownerType: string
  ownerId: string
  onChange: (url: string | undefined) => void
}

export function LogoUploader({
  label,
  description,
  value,
  ownerType,
  ownerId,
  onChange,
}: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      if (!file.type.match(/^image\/(png|jpeg)$/)) {
        setError("File must be PNG or JPEG")
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        setError("File must be under 2MB")
        return
      }

      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("ownerType", ownerType)
        formData.append("ownerId", ownerId)

        const res = await fetch("/api/brand-assets/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Upload failed")
          return
        }

        onChange(data.url)
      } catch {
        setError("Upload failed — please try again")
      } finally {
        setIsUploading(false)
      }
    },
    [ownerType, ownerId, onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reset so same file can be re-selected
      e.target.value = ""
    },
    [handleFile]
  )

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-caption text-muted-foreground">{description}</p>
      )}

      {value ? (
        /* Has logo — show preview */
        <div className="relative flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Logo preview"
            className="max-h-20 w-auto object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        /* Empty or uploading — show dropzone */
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            isDragOver
              ? "border-primary/50 bg-primary/5"
              : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30"
          }`}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="size-6 text-muted-foreground/60" />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Drop image or click to upload
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                PNG or JPG — max 2MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleSelect}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add src/components/brand-editor/logo-uploader.tsx
git commit -m "feat(brand): add LogoUploader drag-and-drop component"
```

---

### Task 4: PreviewQuestions Component

**Files:**
- Create: `src/components/brand-editor/preview-questions.tsx`

**Reference:** `src/components/brand-editor/preview-runner.tsx` for current structure, `src/components/assess/section-wrapper.tsx` for real runner layout.

This is a new component that matches the real assessment question page more accurately than `PreviewRunner`, and accepts `brandName`/`logoUrl` props for live binding. `PreviewRunner` stays unchanged for the platform editor.

- [ ] **Step 1: Create PreviewQuestions**

The component should match the real SectionWrapper layout:
- Header with logo/fallback icon + brand name (from props)
- Thin 2px progress bar
- Assessment name eyebrow (from `brandName` prop) in `--brand-primary`
- Question stem
- Horizontal Likert options
- Footer with save status

```typescript
"use client"

export interface PreviewCardProps {
  brandName?: string
  logoUrl?: string
}

export function PreviewQuestions({ brandName, logoUrl }: PreviewCardProps) {
  const displayName = brandName || "Your Assessment"

  return (
    <div className="space-y-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--brand-text-muted)" }}
      >
        Assessment Questions
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Header with logo/name */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--brand-neutral-200)" }}
        >
          <div className="flex items-center gap-2">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt={displayName}
                className="h-5 w-auto object-contain"
              />
            ) : (
              <div
                className="flex size-6 items-center justify-center"
                style={{
                  borderRadius: "var(--brand-radius-md)",
                  backgroundColor: "var(--brand-surface)",
                }}
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--brand-primary)" }}
                >
                  <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
            )}
            <span
              className="text-xs font-semibold tracking-tight"
              style={{
                color: "var(--brand-text)",
                fontFamily: "var(--brand-font-heading)",
              }}
            >
              {displayName}
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px]"
            style={{ color: "var(--brand-text-muted)" }}
          >
            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {/* Progress bar */}
        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: "var(--brand-neutral-200)" }}
        >
          <div
            className="h-full w-[35%] transition-all duration-500"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
        </div>

        {/* Question content */}
        <div className="px-6 pt-5 pb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--brand-primary)" }}
          >
            {displayName}
          </p>
        </div>
        <div className="px-6 pb-3">
          <p
            className="text-base font-medium leading-relaxed"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            I naturally take charge when a team lacks direction.
          </p>
        </div>

        {/* Likert options */}
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            {[
              "Strongly Disagree",
              "Disagree",
              "Neutral",
              "Agree",
              "Strongly Agree",
            ].map((optionLabel, i) => {
              const isSelected = i === 3
              return (
                <button
                  key={optionLabel}
                  type="button"
                  className="flex-1 py-2.5 px-1 text-[11px] font-medium text-center transition-all duration-200"
                  style={{
                    borderRadius: "var(--brand-radius-lg)",
                    backgroundColor: isSelected
                      ? "var(--brand-primary)"
                      : "var(--brand-neutral-100)",
                    color: isSelected
                      ? "var(--brand-primary-foreground)"
                      : "var(--brand-text-muted)",
                    border: isSelected
                      ? "1px solid transparent"
                      : "1px solid var(--brand-neutral-200)",
                  }}
                >
                  {optionLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center gap-1.5 px-6 py-3"
          style={{
            borderTop: "1px solid var(--brand-neutral-200)",
            color: "var(--brand-text-muted)",
          }}
        >
          <span
            className="inline-block size-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
          <span
            className="text-[11px]"
            style={{ fontFamily: "var(--brand-font-body)" }}
          >
            Responses saved automatically
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add src/components/brand-editor/preview-questions.tsx
git commit -m "feat(brand): add PreviewQuestions component with live props"
```

---

### Task 5: PreviewComplete Component

**Files:**
- Create: `src/components/brand-editor/preview-complete.tsx`

**Reference:** `src/components/assess/complete-screen.tsx` for real layout. Uses same `PreviewCardProps` interface from Task 4.

- [ ] **Step 1: Create PreviewComplete**

```typescript
"use client"

import type { PreviewCardProps } from "./preview-questions"

export function PreviewComplete({ brandName, logoUrl }: PreviewCardProps) {
  const displayName = brandName || "Your Assessment"

  return (
    <div className="space-y-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--brand-text-muted)" }}
      >
        Completion Page
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Header with logo/name */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--brand-neutral-200)" }}
        >
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={displayName}
              className="h-5 w-auto object-contain"
            />
          ) : (
            <div
              className="flex size-6 items-center justify-center"
              style={{
                borderRadius: "var(--brand-radius-md)",
                backgroundColor: "var(--brand-surface)",
              }}
            >
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--brand-primary)" }}
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          )}
          <span
            className="text-xs font-semibold tracking-tight"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            {displayName}
          </span>
        </div>

        {/* Completion content */}
        <div className="px-6 py-10 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex size-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--brand-accent-100)" }}
            >
              <svg
                className="size-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ color: "var(--brand-accent-600)" }}
              >
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h2
              className="text-lg font-semibold tracking-tight"
              style={{
                color: "var(--brand-text)",
                fontFamily: "var(--brand-font-heading)",
              }}
            >
              Thank You
            </h2>
            <p
              className="text-xs leading-relaxed max-w-[260px] mx-auto"
              style={{ color: "var(--brand-neutral-500)" }}
            >
              Your responses have been recorded. You may now close this window.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center px-6 py-3"
          style={{
            borderTop: "1px solid var(--brand-neutral-200)",
            color: "var(--brand-text-muted)",
          }}
        >
          <span
            className="text-[11px]"
            style={{ fontFamily: "var(--brand-font-body)" }}
          >
            Powered by TalentFit
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add src/components/brand-editor/preview-complete.tsx
git commit -m "feat(brand): add PreviewComplete component with live props"
```

---

### Task 6: Update PreviewWelcome to Accept Props

**Files:**
- Modify: `src/components/brand-editor/preview-welcome.tsx`

- [ ] **Step 1: Add props to PreviewWelcome**

Add the import at the top of the file (after `"use client"`):

```typescript
import type { PreviewCardProps } from "./preview-questions"
```

Change the component signature (line 7) from:

```typescript
export function PreviewWelcome() {
```

to:

```typescript
export function PreviewWelcome({ brandName, logoUrl }: PreviewCardProps) {
```

Add a `displayName` variable at the top of the component body:

```typescript
const displayName = brandName || "Your Assessment"
```

Replace the header section (lines 22-55 — the `<div>` with `borderBottom` containing the icon and "Your Brand" text) with the same logo/fallback pattern used in PreviewQuestions:

```typescript
        <div
          className="flex items-center gap-2.5 px-6 py-4"
          style={{ borderBottom: "1px solid var(--brand-neutral-200)" }}
        >
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={displayName}
              className="h-5 w-auto object-contain"
            />
          ) : (
            <div
              className="flex size-7 items-center justify-center"
              style={{
                borderRadius: "var(--brand-radius-md)",
                backgroundColor: "var(--brand-surface)",
              }}
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--brand-primary)" }}
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          )}
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            {displayName}
          </span>
        </div>
```

Keep all other content ("Welcome, Alex", "Begin Assessment", etc.) as-is — those are sample content, not brand-reactive.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 3: Run existing tests**

Run: `npm run test:unit`
Expected: All 65 tests pass (no preview components are unit tested)

- [ ] **Step 4: Commit**

```bash
git add src/components/brand-editor/preview-welcome.tsx
git commit -m "feat(brand): update PreviewWelcome to accept brandName/logoUrl props"
```

---

### Task 7: Update PreviewGallery for New Surfaces and Props

**Files:**
- Modify: `src/components/brand-editor/preview-gallery.tsx`

**This is the integration point.** The gallery must:
1. Expand `PreviewSurface` type to include `"welcome"`, `"questions"`, `"complete"`
2. Import the new components
3. Accept `brandName`/`logoUrl` props and pass them through
4. Update `SURFACE_COMPONENTS` type to support props

- [ ] **Step 1: Update imports**

Add imports at the top of `preview-gallery.tsx` (after existing imports at lines 8-11):

```typescript
import { PreviewQuestions } from "./preview-questions"
import { PreviewComplete } from "./preview-complete"
import { PreviewWelcome } from "./preview-welcome"
```

Remove the existing `PreviewRunner` import (line 8). Add `PreviewWelcome` — it is NOT currently imported.

- [ ] **Step 2: Expand types and maps**

Update the type and maps (lines 23-37):

```typescript
type PreviewSurface = "runner" | "welcome" | "questions" | "complete" | "report" | "email" | "dashboard"

const SURFACE_LABELS: Record<PreviewSurface, string> = {
  runner: "Assessment Runner",
  welcome: "Welcome Page",
  questions: "Assessment Questions",
  complete: "Completion Page",
  report: "Report Cover",
  email: "Email Invitation",
  dashboard: "Dashboard Card",
}

const SURFACE_COMPONENTS: Record<PreviewSurface, React.FC<{ brandName?: string; logoUrl?: string }>> = {
  runner: PreviewQuestions, // backward-compat alias — platform editor uses "runner"
  welcome: PreviewWelcome,
  questions: PreviewQuestions,
  complete: PreviewComplete,
  report: PreviewReport,
  email: PreviewEmail,
  dashboard: PreviewDashboard,
}
```

Note: `PreviewReport`, `PreviewEmail`, `PreviewDashboard` don't accept props — that's fine because TypeScript allows passing props to a component that ignores them. `PreviewRunner` is no longer imported or used in the map.

- [ ] **Step 3: Add brandName/logoUrl to PreviewGalleryProps**

Update the interface (lines 15-21):

```typescript
interface PreviewGalleryProps {
  config: BrandConfig
  compact?: boolean
  surfaces?: PreviewSurface[]
  brandName?: string
  logoUrl?: string
}
```

Update the function signature (line 39):

```typescript
export function PreviewGallery({ config, compact = false, surfaces, brandName, logoUrl }: PreviewGalleryProps) {
```

- [ ] **Step 4: Pass props through to preview components**

Update the render section (around line 127) where `<Component />` is rendered:

```typescript
<Component brandName={brandName} logoUrl={logoUrl} />
```

And the full-screen preview section (around line 187):

```typescript
<FullScreenComponent brandName={brandName} logoUrl={logoUrl} />
```

Note: For the full-screen component, the type of `FullScreenComponent` needs to match. Since `SURFACE_COMPONENTS` values are typed as `React.FC<{ brandName?: string; logoUrl?: string }>`, this will work.

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 6: Run existing tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/brand-editor/preview-gallery.tsx
git commit -m "feat(brand): expand PreviewGallery with new surfaces and prop passthrough"
```

---

### Task 8: Update Campaign Brand Editor

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor.tsx`

This is the main integration task. Add surfaces section, replace logo URL input with uploader, update preview surfaces.

**Reference:** Platform Surfaces tab at `src/app/(dashboard)/settings/brand/brand-editor.tsx:305-382`

- [ ] **Step 1: Add imports**

Add to existing imports (lines 1-17):

```typescript
import { cn } from "@/lib/utils"
import { LogoUploader } from "@/components/brand-editor/logo-uploader"
```

Update the brand types import (line 17) from:

```typescript
import type { BrandConfig, BrandConfigRecord } from "@/lib/brand/types"
```

to:

```typescript
import type { BrandConfig, BrandConfigRecord, NeutralTemperature } from "@/lib/brand/types"
```

- [ ] **Step 2: Add neutral temperature options constant**

Inside the component function, before the return (after the `saveLabel` variable around line 97):

```typescript
const neutralOptions: { value: NeutralTemperature; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "neutral", label: "Neutral" },
  { value: "cool", label: "Cool" },
]
```

- [ ] **Step 3: Replace the Logo URL input with LogoUploader**

Replace the Logo URL section (lines 163-175) with:

```typescript
<div className="space-y-2">
  <LogoUploader
    label="Logo"
    description="Displayed in the runner header and on report cover pages."
    value={config.logoUrl}
    ownerType="campaign"
    ownerId={campaignId}
    onChange={(url) =>
      setConfig((prev) => ({ ...prev, logoUrl: url }))
    }
  />
</div>
```

- [ ] **Step 4: Add Surfaces section**

Add a new `<Card>` after the Colors card (after line 201), inside the `{customEnabled && ( ... )}` block:

```typescript
<Card>
  <CardHeader>
    <CardTitle>Surfaces</CardTitle>
  </CardHeader>
  <CardContent className="space-y-6">
    {/* Neutral temperature */}
    <div className="space-y-2">
      <Label>Neutral Temperature</Label>
      <p className="text-caption text-muted-foreground">
        Controls the hue tint of backgrounds, borders, and muted text.
      </p>
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        {neutralOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                neutralTemperature: opt.value,
              }))
            }
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
              config.neutralTemperature === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {/* Page background */}
    <div>
      <ColorPicker
        label="Page Background"
        description="Main page surface color. Leave empty to derive from neutral temperature."
        value={config.backgroundColor || "#f5f5f4"}
        onChange={(hex) =>
          setConfig((prev) => ({ ...prev, backgroundColor: hex }))
        }
      />
      {config.backgroundColor && (
        <button
          type="button"
          onClick={() =>
            setConfig((prev) => ({ ...prev, backgroundColor: undefined }))
          }
          className="mt-2 text-xs text-primary hover:underline"
        >
          Use neutral temperature instead
        </button>
      )}
    </div>

    {/* Card background */}
    <div>
      <ColorPicker
        label="Card Background"
        description="Card and popover surfaces. Leave empty for white."
        value={config.cardColor || "#ffffff"}
        onChange={(hex) =>
          setConfig((prev) => ({ ...prev, cardColor: hex }))
        }
      />
      {config.cardColor && (
        <button
          type="button"
          onClick={() =>
            setConfig((prev) => ({ ...prev, cardColor: undefined }))
          }
          className="mt-2 text-xs text-primary hover:underline"
        >
          Reset to white
        </button>
      )}
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 5: Update PreviewGallery usage**

Update the `<PreviewGallery>` call (lines 221-224) to pass the new props and surfaces:

```typescript
<PreviewGallery
  config={customEnabled ? config : inheritedBrand}
  surfaces={["welcome", "questions", "complete"]}
  brandName={(customEnabled ? config : inheritedBrand).name}
  logoUrl={(customEnabled ? config : inheritedBrand).logoUrl}
/>
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 7: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/branding/campaign-brand-editor.tsx
git commit -m "feat(brand): add surfaces, logo upload, and live previews to campaign editor"
```

---

### Task 9: Loading State

**Files:**
- Create: `src/app/(dashboard)/campaigns/[id]/branding/loading.tsx`

Per CLAUDE.md: every route must have a `loading.tsx` with shimmer animation.

- [ ] **Step 1: Create loading.tsx**

Match the campaign brand editor layout — left controls panel skeleton + right preview skeleton:

```typescript
export default function BrandingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex gap-8 items-start">
        {/* Controls skeleton */}
        <div className="w-[360px] shrink-0 space-y-6">
          <div className="h-20 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-16 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-64 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-48 rounded-xl bg-muted/40 animate-shimmer" />
        </div>
        {/* Preview skeleton */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="h-8 w-32 rounded-lg bg-muted/40 animate-shimmer" />
          <div className="h-80 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-64 rounded-xl bg-muted/40 animate-shimmer" />
          <div className="h-56 rounded-xl bg-muted/40 animate-shimmer" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/branding/loading.tsx
git commit -m "feat(brand): add shimmer loading state for branding route"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 2: Run all tests**

Run: `npm run test:unit`
Expected: All 65+ tests pass

- [ ] **Step 3: Visual verification**

Start dev server: `npm run dev`

Navigate to a campaign's branding page and verify:
1. Surfaces section appears (temperature toggle + background/card pickers)
2. Logo uploader dropzone renders, drag-and-drop works
3. Three preview cards shown: Welcome, Questions, Complete
4. Changing display name → all preview headers and eyebrows update live
5. Changing primary color → buttons, progress bar, eyebrows update across all cards
6. Changing neutral temperature → card backgrounds and borders shift
7. Changing page/card background → preview container/card surfaces update
8. Light/Dark/Mobile toggle works with all new controls
9. Save + reload preserves all settings
10. Unsaved changes warning fires on navigate-away
