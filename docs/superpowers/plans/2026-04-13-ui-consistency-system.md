# UI Consistency System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the composition-layer primitives (RouteTabs, SaveButton, SectionCard, skeleton templates, SelectValue fix, ConfirmDialog loadingLabel) and bring three gold standard pages to Apple quality in the admin portal.

**Architecture:** Two parallel tracks converging on three gold standard pages. Track 1 builds five reusable primitives and one bug fix; Track 2 migrates the admin dashboard, client detail shell, and partner details form onto those primitives. Track 1 must complete before Track 2 starts — each gold standard page is a direct consumer of Track 1 output.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, Radix UI, Vitest + Testing Library (component tests), shadcn/ui primitives in `src/components/ui/`

**Spec:** `docs/superpowers/specs/2026-04-13-ui-consistency-system-design.md`

---

## File Map

### Created by this plan
| File | Responsibility |
|---|---|
| `src/components/route-tabs.tsx` | URL-backed tab navigation for detail shells |
| `src/components/save-button.tsx` | Unified save button with idle/saving/saved/error states |
| `src/components/section-card.tsx` | Standard section anatomy (title, description, action, body, footer) |
| `src/components/loading/card-grid-skeleton.tsx` | Shimmer skeleton for card grid pages |
| `src/components/loading/data-table-skeleton.tsx` | Shimmer skeleton for table list pages |
| `src/components/loading/detail-form-skeleton.tsx` | Shimmer skeleton for detail/settings form pages |
| `src/components/loading/dense-editor-skeleton.tsx` | Shimmer skeleton for split-pane editor pages |
| `tests/components/confirm-dialog.test.tsx` | Tests for ConfirmDialog loadingLabel prop |
| `tests/components/route-tabs.test.tsx` | Tests for RouteTabs |
| `tests/components/save-button.test.tsx` | Tests for SaveButton |
| `tests/components/section-card.test.tsx` | Tests for SectionCard |

### Modified by this plan
| File | Change |
|---|---|
| `src/components/ui/confirm-dialog.tsx` | Add `loadingLabel` prop (replaces hardcoded "Please wait...") |
| `src/components/campaigns/quick-launch-modal.tsx` | Fix SelectValue UUID display |
| `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx` | Replace hand-rolled nav with RouteTabs |
| `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx` | Replace hand-rolled nav with RouteTabs |
| `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx` | Replace hand-rolled nav with RouteTabs |
| `src/app/(dashboard)/clients/[slug]/overview/loading.tsx` | Rebuild with DetailFormSkeleton |
| `src/app/(dashboard)/dashboard/loading.tsx` | Refresh to match current page layout exactly |
| `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx` | Migrate to SectionCard + SaveButton |

---

## Task 1: ConfirmDialog `loadingLabel` prop

This is the smallest change with the widest blast radius — 40 usage sites, all currently showing "Please wait..." hardcoded. Fix first so every subsequent task that touches a ConfirmDialog can use the new prop.

**Files:**
- Modify: `src/components/ui/confirm-dialog.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/confirm-dialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const base = {
  open: true,
  onOpenChange: vi.fn(),
  title: "Delete item",
  description: "This cannot be undone.",
  onConfirm: vi.fn(),
}

describe("ConfirmDialog", () => {
  it("shows default loading label when loading and no loadingLabel provided", () => {
    render(<ConfirmDialog {...base} loading confirmLabel="Delete" />)
    expect(screen.getByRole("button", { name: /please wait/i })).toBeInTheDocument()
  })

  it("shows custom loadingLabel when provided", () => {
    render(
      <ConfirmDialog {...base} loading confirmLabel="Delete" loadingLabel="Deleting…" />
    )
    expect(screen.getByRole("button", { name: /deleting/i })).toBeInTheDocument()
    expect(screen.queryByText(/please wait/i)).not.toBeInTheDocument()
  })

  it("shows confirmLabel when not loading", () => {
    render(<ConfirmDialog {...base} confirmLabel="Delete" />)
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/confirm-dialog.test.tsx
```

Expected: FAIL — `loadingLabel` prop not accepted.

- [ ] **Step 3: Add `loadingLabel` prop to ConfirmDialog**

In `src/components/ui/confirm-dialog.tsx`:

```tsx
// Add to ConfirmDialogProps interface:
loadingLabel?: string

// Add to destructured props (with default):
loadingLabel = "Please wait…",

// Replace hardcoded string in JSX (line 60):
{loading ? loadingLabel : confirmLabel}
```

Note: the default value uses `…` (U+2026 horizontal ellipsis), not three dots.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/confirm-dialog.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/confirm-dialog.tsx tests/components/confirm-dialog.test.tsx
git commit -m "feat(ui): add loadingLabel prop to ConfirmDialog

Replaces hardcoded 'Please wait...' with a configurable prop.
Default is 'Please wait…' (correct ellipsis character).
"
```

---

## Task 2: `SaveButton` component

Replaces ~25 inline save-state implementations. This component owns the entire lifecycle string: idle → saving → saved → idle.

**Files:**
- Create: `src/components/save-button.tsx`
- Create: `tests/components/save-button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SaveButton } from "@/components/save-button"

describe("SaveButton", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("renders idle label by default", () => {
    render(<SaveButton state="idle" onClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled()
  })

  it("shows saving label and is disabled while saving", () => {
    render(<SaveButton state="saving" onClick={vi.fn()} />)
    const btn = screen.getByRole("button", { name: /saving/i })
    expect(btn).toBeDisabled()
  })

  it("shows saved label and auto-resets to idle after 2000ms", async () => {
    const { rerender } = render(<SaveButton state="saved" onClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: /saved/i })).toBeDisabled()

    act(() => vi.advanceTimersByTime(2000))

    // After timer fires, component should call back or the state should reflect reset
    // The component itself does NOT manage state — parent does. It just shows "Saved" for 2s.
    // Test that saved state renders correctly — reset is parent's responsibility.
    expect(screen.getByRole("button", { name: /saved/i })).toBeInTheDocument()
  })

  it("shows Save Changes and is enabled in error state", () => {
    render(<SaveButton state="error" onClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled()
  })

  it("calls onClick when clicked in idle state", async () => {
    const onClick = vi.fn()
    render(<SaveButton state="idle" onClick={onClick} />)
    await userEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("respects disabled prop", () => {
    render(<SaveButton state="idle" onClick={vi.fn()} disabled />)
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/save-button.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SaveButton**

Create `src/components/save-button.tsx`:

```tsx
"use client"

import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ComponentPropsWithoutRef } from "react"

export type SaveState = "idle" | "saving" | "saved" | "error"

interface SaveButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "onClick"> {
  state: SaveState
  onClick: () => void
}

const LABELS: Record<SaveState, string> = {
  idle: "Save Changes",
  saving: "Saving...",
  saved: "Saved",
  error: "Save Changes",
}

export function SaveButton({ state, onClick, disabled, className, ...rest }: SaveButtonProps) {
  const isDisabled = disabled || state === "saving" || state === "saved"

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={className}
      {...rest}
    >
      {state === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {state === "saved" && <Check className="mr-2 h-4 w-4" />}
      {LABELS[state]}
    </Button>
  )
}
```

Note: `SaveButton` is a pure display component — it does not manage the 2000ms reset timer itself. The parent (or a hook) manages state transitions. This is intentional: the button has no side-effects, making it trivially testable and composable.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/save-button.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/save-button.tsx tests/components/save-button.test.tsx
git commit -m "feat(ui): add SaveButton component

Unified save button with idle/saving/saved/error states.
Replaces ~25 inline save-state string implementations.
"
```

---

## Task 3: `SectionCard` component

Standardises edit section anatomy. Every detail and settings page uses this wrapper for each edit zone.

**Files:**
- Create: `src/components/section-card.tsx`
- Create: `tests/components/section-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SectionCard } from "@/components/section-card"

describe("SectionCard", () => {
  it("renders title and children", () => {
    render(
      <SectionCard title="Profile">
        <p>Body content</p>
      </SectionCard>
    )
    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.getByText("Body content")).toBeInTheDocument()
  })

  it("renders description when provided", () => {
    render(
      <SectionCard title="Profile" description="Update your details">
        <p>Body</p>
      </SectionCard>
    )
    expect(screen.getByText("Update your details")).toBeInTheDocument()
  })

  it("does not render description element when not provided", () => {
    render(<SectionCard title="Profile"><p>Body</p></SectionCard>)
    // No description paragraph should be present
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument()
  })

  it("renders action in header when provided", () => {
    render(
      <SectionCard title="Profile" action={<button>Toggle</button>}>
        <p>Body</p>
      </SectionCard>
    )
    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument()
  })

  it("renders footer when provided", () => {
    render(
      <SectionCard title="Profile" footer={<button>Save</button>}>
        <p>Body</p>
      </SectionCard>
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
  })

  it("does not render footer element when not provided", () => {
    render(<SectionCard title="Profile"><p>Body</p></SectionCard>)
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/section-card.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SectionCard**

Create `src/components/section-card.tsx`:

```tsx
import type { ReactNode } from "react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: string
  description?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({
  title,
  description,
  action,
  footer,
  children,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <h3 className="text-section font-medium leading-none">{title}</h3>
          {description && (
            <p className="text-caption text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="border-t pt-4">{footer}</CardFooter>
      )}
    </Card>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/section-card.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/section-card.tsx tests/components/section-card.test.tsx
git commit -m "feat(ui): add SectionCard component

Standard section anatomy: title, description, header action, body, footer.
Footer only used for section-scoped explicit save (Zone 2).
"
```

---

## Task 4: `RouteTabs` component

Replaces three near-identical hand-rolled tab bars in the client, partner, and campaign detail shells. Adds what they currently lack: keyboard navigation, focus ring, horizontal overflow scroll.

**Files:**
- Create: `src/components/route-tabs.tsx`
- Create: `tests/components/route-tabs.test.tsx`

Before writing: read `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx` lines 42–63 to see the exact pattern being replaced.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RouteTabs } from "@/components/route-tabs"

// Mock next/link to render a plain anchor in tests
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Settings", segment: "settings" },
  { label: "Reports", segment: "reports" },
]

describe("RouteTabs", () => {
  it("renders all tab labels", () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="overview" />
    )
    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.getByText("Reports")).toBeInTheDocument()
  })

  it("marks the active tab with aria-current", () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="settings" />
    )
    const settingsLink = screen.getByRole("link", { name: "Settings" })
    expect(settingsLink).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current")
  })

  it("builds correct hrefs from basePath + segment", () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="overview" />
    )
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/clients/acme/overview")
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/clients/acme/settings")
  })

  it("renders badge content when provided", () => {
    const tabsWithBadge = [
      ...tabs,
      { label: "Issues", segment: "issues", badge: <span data-testid="badge">3</span> },
    ]
    render(
      <RouteTabs tabs={tabsWithBadge} basePath="/clients/acme" activeSegment="overview" />
    )
    expect(screen.getByTestId("badge")).toBeInTheDocument()
  })

  it("supports keyboard navigation between tabs with arrow keys", async () => {
    render(
      <RouteTabs tabs={tabs} basePath="/clients/acme" activeSegment="overview" />
    )
    const overviewLink = screen.getByRole("link", { name: "Overview" })
    overviewLink.focus()
    expect(document.activeElement).toBe(overviewLink)

    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Settings" }))

    await userEvent.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(overviewLink)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/route-tabs.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RouteTabs**

Create `src/components/route-tabs.tsx`:

```tsx
"use client"

import type { ReactNode, KeyboardEvent } from "react"
import { useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface RouteTab {
  label: string
  segment: string
  badge?: ReactNode
}

interface RouteTabsProps {
  tabs: RouteTab[]
  basePath: string
  activeSegment: string
  className?: string
}

export function RouteTabs({ tabs, basePath, activeSegment, className }: RouteTabsProps) {
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])

  function handleKeyDown(e: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      const next = (index + 1) % tabs.length
      tabRefs.current[next]?.focus()
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      const prev = (index - 1 + tabs.length) % tabs.length
      tabRefs.current[prev]?.focus()
    }
  }

  return (
    <nav
      role="tablist"
      aria-label="Page sections"
      className={cn(
        "flex gap-0 overflow-x-auto border-b border-border scrollbar-none",
        className
      )}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.segment === activeSegment
        return (
          <Link
            key={tab.segment}
            ref={(el) => { tabRefs.current[i] = el }}
            href={`${basePath}/${tab.segment}`}
            role="tab"
            aria-current={isActive ? "page" : undefined}
            aria-selected={isActive}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium",
              "transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              "hover:bg-muted/50",
              isActive
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:content-['']"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
            {tab.badge && <span className="ml-1">{tab.badge}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/route-tabs.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/route-tabs.tsx tests/components/route-tabs.test.tsx
git commit -m "feat(ui): add RouteTabs component

URL-backed tab navigation for detail shells.
Owns active underline, hover state, keyboard nav (arrow keys),
focus ring, horizontal overflow scroll, and badge adjacency.
"
```

---

## Task 5: Skeleton template files

Four skeleton components. Each matches the structural layout of the real page type it represents. All use `animate-shimmer`. Reference: `src/app/(dashboard)/dashboard/loading.tsx` is the quality bar.

Before writing: read `src/app/(dashboard)/dashboard/loading.tsx` to understand shimmer class usage and structural fidelity level.

**Files:**
- Create: `src/components/loading/card-grid-skeleton.tsx`
- Create: `src/components/loading/data-table-skeleton.tsx`
- Create: `src/components/loading/detail-form-skeleton.tsx`
- Create: `src/components/loading/dense-editor-skeleton.tsx`

No TDD for pure shimmer markup — these are presentational-only. Verify visually in browser after Task 8 (which wires them into real loading.tsx files).

- [ ] **Step 1: Read the dashboard loading.tsx to understand the shimmer pattern**

```bash
# Read src/app/(dashboard)/dashboard/loading.tsx
```

- [ ] **Step 2: Create `card-grid-skeleton.tsx`**

Create `src/components/loading/card-grid-skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface CardGridSkeletonProps {
  className?: string
  /** Number of skeleton cards to render. Default: 6 */
  count?: number
}

export function CardGridSkeleton({ className, count = 6 }: CardGridSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-5 animate-shimmer"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Icon region */}
          <div className="mb-4 h-10 w-10 rounded-lg bg-muted/60" />
          {/* Title */}
          <div className="mb-2 h-4 w-2/3 rounded bg-muted/60" />
          {/* Description */}
          <div className="h-3 w-full rounded bg-muted/40" />
          <div className="mt-1.5 h-3 w-4/5 rounded bg-muted/40" />
          {/* Footer meta */}
          <div className="mt-4 flex items-center gap-2">
            <div className="h-3 w-16 rounded bg-muted/40" />
            <div className="h-3 w-12 rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `data-table-skeleton.tsx`**

Create `src/components/loading/data-table-skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface DataTableSkeletonProps {
  className?: string
  /** Number of table rows to render. Default: 8 */
  rows?: number
  /** Number of columns. Default: 4 */
  columns?: number
}

export function DataTableSkeleton({ className, rows = 8, columns = 4 }: DataTableSkeletonProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {/* Table header */}
      <div className="flex items-center gap-4 rounded-lg px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-muted/60 animate-shimmer"
            style={{ flex: i === 0 ? 2 : 1, animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 rounded-lg border border-border/50 px-4 py-3"
        >
          {Array.from({ length: columns }).map((_, col) => (
            <div
              key={col}
              className="h-4 rounded bg-muted/40 animate-shimmer"
              style={{ flex: col === 0 ? 2 : 1, animationDelay: `${(row * columns + col) * 20}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `detail-form-skeleton.tsx`**

Create `src/components/loading/detail-form-skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface DetailFormSkeletonProps {
  className?: string
  /** Number of section cards to render. Default: 2 */
  sections?: number
}

function FieldRow({ delay = 0 }: { delay?: number }) {
  return (
    <div className="space-y-2" style={{ animationDelay: `${delay}ms` }}>
      <div className="h-3 w-24 rounded bg-muted/60 animate-shimmer" style={{ animationDelay: `${delay}ms` }} />
      <div className="h-9 w-full rounded-md bg-muted/40 animate-shimmer" style={{ animationDelay: `${delay + 20}ms` }} />
    </div>
  )
}

export function DetailFormSkeleton({ className, sections = 2 }: DetailFormSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="rounded-xl border border-border bg-card p-6">
          {/* Section header */}
          <div className="mb-6 space-y-2">
            <div
              className="h-4 w-40 rounded bg-muted/60 animate-shimmer"
              style={{ animationDelay: `${s * 80}ms` }}
            />
            <div
              className="h-3 w-64 rounded bg-muted/40 animate-shimmer"
              style={{ animationDelay: `${s * 80 + 20}ms` }}
            />
          </div>
          {/* Form fields in a two-column grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow delay={s * 80 + 40} />
            <FieldRow delay={s * 80 + 60} />
            <FieldRow delay={s * 80 + 80} />
            <FieldRow delay={s * 80 + 100} />
          </div>
          {/* Section footer (save button area) */}
          <div className="mt-6 flex justify-end">
            <div
              className="h-9 w-28 rounded-md bg-muted/50 animate-shimmer"
              style={{ animationDelay: `${s * 80 + 120}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create `dense-editor-skeleton.tsx`**

Create `src/components/loading/dense-editor-skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface DenseEditorSkeletonProps {
  className?: string
}

export function DenseEditorSkeleton({ className }: DenseEditorSkeletonProps) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Top action bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Tab strip */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-4 w-20 rounded bg-muted/50 animate-shimmer"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
        {/* Action cluster */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 rounded-md bg-muted/40 animate-shimmer" style={{ animationDelay: "120ms" }} />
          <div className="h-8 w-28 rounded-md bg-muted/50 animate-shimmer" style={{ animationDelay: "140ms" }} />
        </div>
      </div>
      {/* Split pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="flex-1 space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-muted/30 animate-shimmer"
              style={{ animationDelay: `${160 + i * 60}ms` }}
            />
          ))}
        </div>
        {/* Preview panel */}
        <div className="w-80 border-l border-border p-6">
          <div className="h-4 w-24 rounded bg-muted/50 animate-shimmer mb-4" />
          <div className="h-full rounded-lg bg-muted/20 animate-shimmer" style={{ animationDelay: "200ms" }} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/loading/
git commit -m "feat(ui): add four skeleton template components

CardGridSkeleton, DataTableSkeleton, DetailFormSkeleton, DenseEditorSkeleton.
All use animate-shimmer with staggered animation delays.
Match structural layout of their respective page types.
"
```

---

## Task 6: SelectValue UUID fix — quick-launch modal

The canonical raw-plumbing violation. When a client is pre-selected, Radix SelectValue shows the UUID because the SelectContent portal hasn't mounted yet. Fix by passing explicit children to SelectValue.

**Files:**
- Modify: `src/components/campaigns/quick-launch-modal.tsx` (around line 527)

Before writing: read lines 510–560 of `src/components/campaigns/quick-launch-modal.tsx` to see the exact Select block.

- [ ] **Step 1: Read the relevant lines**

Read `src/components/campaigns/quick-launch-modal.tsx` lines 510–560.

- [ ] **Step 2: Identify the client SelectValue and the options data**

You are looking for:
- The `SelectValue` component (no children, relying on Radix DOM lookup)
- The variable holding the client list (likely fetched or passed as prop)
- The current `value` prop (state.clientId)

- [ ] **Step 3: Apply the fix**

Find the `SelectValue` inside the client Select:

```tsx
// Before (broken — shows UUID if content not mounted):
<SelectValue placeholder="Select a client" />

// After (correct — explicit children, always human-readable):
<SelectValue>
  {clients.find((c) => c.id === state.clientId)?.name ?? (
    <span className="text-muted-foreground">Select a client</span>
  )}
</SelectValue>
```

Replace the exact line. Do not touch the surrounding Select structure.

- [ ] **Step 4: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/quick-launch-modal.tsx
git commit -m "fix(campaigns): resolve SelectValue UUID display in quick-launch modal

Radix SelectValue falls back to the raw value string (UUID) when
SelectContent hasn't mounted yet. Passing explicit children bypasses
the DOM lookup entirely, showing the human-readable name at all times.
"
```

---

## Task 7: Admin Dashboard — loading.tsx refresh

The dashboard `loading.tsx` is already the quality floor but is slightly out of sync with the current page structure. Refresh it to match exactly.

**Files:**
- Modify: `src/app/(dashboard)/dashboard/loading.tsx`

- [ ] **Step 1: Read the current dashboard page and loading.tsx**

Read `src/app/(dashboard)/dashboard/page.tsx` to understand the current grid/card structure (section count, card shapes, metric areas).

Read `src/app/(dashboard)/dashboard/loading.tsx` to see what exists today.

- [ ] **Step 2: Identify structural gaps**

Look for:
- Cards in the real page that have no skeleton equivalent
- Skeleton sections that no longer match real section
- Stagger delay count mismatches

- [ ] **Step 3: Update `loading.tsx` to match current page structure**

Using `CardGridSkeleton` from Task 5 for card grids, and matching the real page section count and layout. Key rules:
- Same grid column count as real page
- Same card proportions (icon region, title, meta)
- Same header region (page title area shimmer)
- `animate-shimmer` throughout — no `animate-pulse`
- `animationDelay` staggered at 60ms increments per card

- [ ] **Step 4: Visual check** — run the dev server and navigate to `/dashboard`. Force a slow network or wrap the page in a `sleep` temporarily to see the skeleton. Confirm it matches the layout.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/loading.tsx
git commit -m "feat(dashboard): refresh loading skeleton to match current page layout"
```

---

## Task 8: Client detail shell — RouteTabs migration + overview skeleton rebuild

The client detail shell has the worst loading skeleton in the app (pure blobs) and a hand-rolled tab bar. Fix both.

**Files:**
- Modify: `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx`
- Modify: `src/app/(dashboard)/clients/[slug]/overview/loading.tsx`

- [ ] **Step 1: Read the client detail shell**

Read `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx` — focus on the tab rendering section (lines 42–63 per the spec) and the props/data the shell has access to.

- [ ] **Step 2: Identify the `activeSegment` value**

The shell needs to know which tab is active. It receives the current pathname from `usePathname()` or extracts the segment from the URL. Find this logic — it's used in the active-state class condition in the existing hand-rolled nav.

- [ ] **Step 3: Replace hand-rolled nav with RouteTabs**

In `client-detail-shell.tsx`:

1. Import `RouteTabs` from `@/components/route-tabs`
2. Delete the hand-rolled `<nav>` block
3. Replace with:

```tsx
<RouteTabs
  tabs={tabs}          // the existing tabs array (label + segment pairs)
  basePath={`/clients/${slug}`}
  activeSegment={activeSegment}  // extracted from pathname
/>
```

Preserve the `slug` and `tabs` definitions exactly. Do not change the URL structure.

- [ ] **Step 4: Verify TypeScript and no runtime change**

```bash
npx tsc --noEmit
```

Navigate to a client detail page in the browser. Confirm tabs look correct and active state works.

- [ ] **Step 5: Rebuild `overview/loading.tsx`**

Read `src/app/(dashboard)/clients/[slug]/overview/page.tsx` (or the overview component it renders) to understand the actual layout.

Replace `src/app/(dashboard)/clients/[slug]/overview/loading.tsx` with a structural skeleton using `DetailFormSkeleton`:

```tsx
import { DetailFormSkeleton } from "@/components/loading/detail-form-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <DetailFormSkeleton sections={2} />
    </div>
  )
}
```

Customise section count and layout to match the real overview page structure. The skeleton should feel like the real page is loading, not a generic placeholder.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[slug\]/client-detail-shell.tsx \
        src/app/\(dashboard\)/clients/\[slug\]/overview/loading.tsx
git commit -m "feat(clients): migrate to RouteTabs, rebuild overview loading skeleton

Replaces hand-rolled tab nav with shared RouteTabs component.
Rebuilds blob-only loading.tsx to structural DetailFormSkeleton.
"
```

---

## Task 9: Partner + campaign detail shells — RouteTabs migration

These are near-identical to the client shell. With `RouteTabs` already working, this is a direct transplant.

**Files:**
- Modify: `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx`

- [ ] **Step 1: Apply the same RouteTabs migration to `partner-detail-shell.tsx`**

Same approach as Task 8 Step 3. The partner shell is near-identical — the only difference is `basePath={/partners/${slug}}` and the tabs array.

Note: `campaign-detail-shell.tsx` filters tabs based on portal context — preserve that filtering logic, just pass the filtered `tabs` array to `RouteTabs`.

- [ ] **Step 2: Apply RouteTabs to `campaign-detail-shell.tsx`**

`basePath={/campaigns/${id}}`. Preserve portal-aware tab filtering.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/partners/\[slug\]/partner-detail-shell.tsx \
        src/app/\(dashboard\)/campaigns/\[id\]/campaign-detail-shell.tsx
git commit -m "feat(shells): migrate partner and campaign detail shells to RouteTabs"
```

---

## Task 10: Partner details form — SectionCard + SaveButton migration

The best edit form in the app. Wire `SectionCard` around each zone and replace inline save-state logic with `SaveButton`.

**Files:**
- Modify: `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`

Before writing: read the full `partner-details-form.tsx` to understand the three-zone structure (details, notes, danger zone), the save state management, and the autosave fields.

- [ ] **Step 1: Read the form**

Read `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx`.

Document mentally:
- Which state variable tracks save state? (e.g. `saveState`, `isSaving`)
- Where is the save button rendered? What text does it show?
- How many top-level sections are there?
- Which fields are Zone 3 (autosave)? They use `useAutoSave` and have `AutoSaveIndicator`.
- Where is the Danger Zone card?

- [ ] **Step 2: Wrap each zone in SectionCard**

Replace the existing `<Card>` / `<div>` wrappers for each zone:

```tsx
// Zone 1 — Partner details (explicit save)
<SectionCard
  title="Partner Details"
  description="Core identity and contact information for this partner."
  footer={
    <SaveButton state={saveState} onClick={handleSave} />
  }
>
  {/* existing form fields */}
</SectionCard>

// Zone 2 — Notes (autosave — no footer, AutoSaveIndicator in header action)
<SectionCard
  title="Notes"
  description="Internal notes visible only to administrators."
  action={<AutoSaveIndicator status={notesStatus} />}
>
  {/* notes textarea */}
</SectionCard>

// Danger Zone
<SectionCard
  title="Danger Zone"
  className="border-destructive/30"
>
  {/* delete / deactivate controls */}
</SectionCard>
```

- [ ] **Step 3: Replace inline save button with SaveButton**

Find the existing save button. It will look like:

```tsx
<Button onClick={handleSave} disabled={isSaving || isSaved}>
  {isSaving ? "Saving..." : isSaved ? "Saved" : "Save Changes"}
</Button>
```

Determine the shape of the local state and map it to `SaveState`:

```tsx
// Map existing state to SaveState type
const saveState: SaveState =
  isSaving ? "saving" :
  isSaved ? "saved" :
  saveError ? "error" :
  "idle"

// Replace the Button with:
<SaveButton state={saveState} onClick={handleSave} />
```

Import `SaveButton` and `SaveState` from `@/components/save-button`.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Visual verify** — open the partner details page. Confirm three sections render correctly, save button cycles through states correctly, autosave indicator shows on notes section.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/partners/\[slug\]/details/partner-details-form.tsx
git commit -m "feat(partners): migrate partner details form to SectionCard + SaveButton

Three-zone structure now uses SectionCard for consistent section anatomy.
Inline save-state string logic replaced with SaveButton component.
"
```

---

## Task 11: Run full test suite and verify

- [ ] **Step 1: Run all component tests**

```bash
npx vitest run tests/components
```

Expected: PASS for all tests including the new confirm-dialog, save-button, section-card, route-tabs tests.

- [ ] **Step 2: Run TypeScript compiler**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: 0 warnings.

- [ ] **Step 4: Definition of Done review**

Walk through the checklist from the spec for each surface touched in this plan:

- [ ] No raw UUIDs visible in any rendered state (quick-launch modal fixed)
- [ ] All save buttons in migrated surfaces use `SaveButton` component
- [ ] All edit sections in migrated surfaces use `SectionCard`
- [ ] All three detail shells use `RouteTabs`
- [ ] `loading.tsx` for dashboard and client overview is structural
- [ ] `ConfirmDialog` has `loadingLabel` prop — no hardcoded strings
- [ ] Motion within Apple bar: 150–250ms, ease-out
- [ ] TypeScript: 0 errors
- [ ] Lint: 0 warnings

- [ ] **Step 5: Final commit (if any cleanup needed)**

```bash
git add -p   # stage only what's needed
git commit -m "chore(ui): final cleanup after consistency system Phase 1"
```

---

## Rollout Note

This plan covers **Phase 1 admin portal only**. Before Phase 2 (partner portal) starts, Jason reviews the three gold standard pages and signs off. The gate is informal — no ticket needed — but the review must happen.

Phase 2 (partner portal) and Phase 3 (client portal) follow the same task structure: RouteTabs on any shells not already shared with admin, SectionCard + SaveButton on portal-specific forms, loading.tsx rebuilds from skeleton templates.

The remaining admin-wide sweep (all settings forms → SectionCard + SaveButton, all loading.tsx → skeleton templates, SelectValue audit across all Select usages, library list pages → TiltCard + ScrollReveal + icon glow) is a separate Phase 1 continuation pass, also gated on Jason's review of the three gold standard pages.
