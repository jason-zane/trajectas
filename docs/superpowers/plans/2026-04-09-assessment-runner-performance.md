# Assessment Runner Performance & Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the assessment runner feel instant by switching to optimistic saves, fixing race conditions, and polishing the Likert UI.

**Architecture:** Postgres RPC functions combine auth validation + write in a single round-trip. The client advances optimistically on click, queueing saves in the background with retry. A ref-based navigation lock prevents double-advance. CSS Grid replaces flexbox for equal-size Likert buttons.

**Tech Stack:** Next.js App Router, Supabase (Postgres RPC), React refs for queue/lock, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-04-09-assessment-runner-performance-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260409140000_assessment_runner_rpc.sql` | **New** — Postgres RPC functions (`save_response_for_session`, `update_session_progress_for_session`) |
| `src/app/actions/assess.ts` | **Modify** — Add `saveResponseLite()` and `updateSessionProgressLite()` server actions that call the RPCs |
| `src/app/api/assess/progress/route.ts` | **New** — `sendBeacon` POST endpoint for `beforeunload` progress flush |
| `src/components/assess/section-wrapper.tsx` | **Modify** — Optimistic response handling, save queue, debounced progress, nav lock |
| `src/components/assess/formats/likert-response.tsx` | **Modify** — CSS Grid layout, larger min-height, equal sizing |
| `tests/unit/save-queue.test.ts` | **New** — Unit tests for the save queue logic (extracted as pure functions) |
| `tests/components/likert-response.test.tsx` | **New** — Component tests for Likert grid rendering |
| `tests/integration/assess-progress-api.test.ts` | **New** — Integration test for the sendBeacon progress endpoint |

---

### Task 1: Postgres RPC Functions (Migration)

**Files:**
- Create: `supabase/migrations/20260409140000_assessment_runner_rpc.sql`

- [ ] **Step 1: Create migration file with both RPC functions**

```sql
-- Save a participant response with single-roundtrip ownership validation.
-- Used by the assessment runner's optimistic save queue.
CREATE OR REPLACE FUNCTION save_response_for_session(
  p_access_token text,
  p_session_id uuid,
  p_item_id uuid,
  p_section_id uuid,
  p_response_value numeric,
  p_response_data jsonb DEFAULT '{}',
  p_response_time_ms integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_valid boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM participant_sessions ps
    JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
    WHERE ps.id = p_session_id
      AND cp.access_token = p_access_token
      AND ps.status = 'in_progress'
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN false;
  END IF;

  INSERT INTO participant_responses (session_id, item_id, section_id, response_value, response_data, response_time_ms)
  VALUES (p_session_id, p_item_id, p_section_id, p_response_value, p_response_data, p_response_time_ms)
  ON CONFLICT (session_id, item_id)
  DO UPDATE SET
    response_value = EXCLUDED.response_value,
    response_data = EXCLUDED.response_data,
    response_time_ms = EXCLUDED.response_time_ms;

  RETURN true;
END;
$$;

-- Update session progress with single-roundtrip ownership validation.
-- Used by the debounced progress updater and sendBeacon endpoint.
CREATE OR REPLACE FUNCTION update_session_progress_for_session(
  p_access_token text,
  p_session_id uuid,
  p_current_section_id uuid DEFAULT NULL,
  p_current_item_index integer DEFAULT NULL,
  p_time_remaining jsonb DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_participant_id uuid;
BEGIN
  SELECT cp.id INTO v_participant_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token;

  IF v_participant_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE participant_sessions
  SET current_section_id = COALESCE(p_current_section_id, current_section_id),
      current_item_index = COALESCE(p_current_item_index, current_item_index),
      time_remaining_seconds = COALESCE(p_time_remaining, time_remaining_seconds)
  WHERE id = p_session_id
    AND campaign_participant_id = v_participant_id;

  RETURN true;
END;
$$;
```

- [ ] **Step 2: Apply the migration to the remote database**

Run: `npx supabase db push`
Expected: Migration applied successfully.

- [ ] **Step 3: Verify the functions exist**

Run: `npx supabase db run "SELECT proname FROM pg_proc WHERE proname IN ('save_response_for_session', 'update_session_progress_for_session');"`
Expected: Both function names returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260409140000_assessment_runner_rpc.sql
git commit -m "feat(assess): add Postgres RPC functions for single-roundtrip response saves"
```

---

### Task 2: Lightweight Server Actions

**Files:**
- Modify: `src/app/actions/assess.ts` (append after existing `updateSessionProgress` function, around line 618)

- [ ] **Step 1: Add `saveResponseLite` server action**

Append to `src/app/actions/assess.ts` after the existing `updateSessionProgress` function (before the `// Session completion` section comment at line 622):

```typescript
// ---------------------------------------------------------------------------
// Lightweight save actions (single DB round-trip via RPC)
// ---------------------------------------------------------------------------

/**
 * Save a response using a single Postgres RPC call that combines
 * ownership validation + upsert. Used by the optimistic save queue
 * in the assessment runner.
 */
export async function saveResponseLite(input: {
  token: string
  sessionId: string
  itemId: string
  sectionId: string
  responseValue: number
  responseData?: Record<string, unknown>
  responseTimeMs?: number
}) {
  const db = createAdminClient()

  const { data, error } = await db.rpc('save_response_for_session', {
    p_access_token: input.token,
    p_session_id: input.sessionId,
    p_item_id: input.itemId,
    p_section_id: input.sectionId,
    p_response_value: input.responseValue,
    p_response_data: input.responseData ?? {},
    p_response_time_ms: input.responseTimeMs ?? null,
  })

  if (error || data === false) {
    logActionError('saveResponseLite.rpc', error ?? 'ownership check failed')
    return { error: 'Unable to save response' }
  }
  return { success: true as const }
}

/**
 * Update session progress using a single Postgres RPC call.
 * Used by the debounced progress updater in the assessment runner.
 */
export async function updateSessionProgressLite(
  token: string,
  sessionId: string,
  update: {
    sectionId: string
    itemIndex: number
  },
) {
  const db = createAdminClient()

  const { data, error } = await db.rpc('update_session_progress_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_current_section_id: update.sectionId,
    p_current_item_index: update.itemIndex,
  })

  if (error || data === false) {
    logActionError('updateSessionProgressLite.rpc', error ?? 'ownership check failed')
    return { error: 'Unable to save progress' }
  }
  return { success: true as const }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors in `assess.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/assess.ts
git commit -m "feat(assess): add lightweight saveResponseLite and updateSessionProgressLite actions"
```

---

### Task 3: SendBeacon Progress API Route

**Files:**
- Create: `src/app/api/assess/progress/route.ts`
- Create: `tests/integration/assess-progress-api.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/assess-progress-api.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}))

// Import after mocks
const { POST } = await import('@/app/api/assess/progress/route')

describe('POST /api/assess/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 when progress update succeeds', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const req = new Request('http://localhost/api/assess/progress', {
      method: 'POST',
      body: JSON.stringify({
        token: 'test-token',
        sessionId: 'session-123',
        sectionId: 'section-456',
        itemIndex: 5,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('update_session_progress_for_session', {
      p_access_token: 'test-token',
      p_session_id: 'session-123',
      p_current_section_id: 'section-456',
      p_current_item_index: 5,
    })
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('http://localhost/api/assess/progress', {
      method: 'POST',
      body: JSON.stringify({ token: 'test-token' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 when ownership check fails', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const req = new Request('http://localhost/api/assess/progress', {
      method: 'POST',
      body: JSON.stringify({
        token: 'bad-token',
        sessionId: 'session-123',
        sectionId: 'section-456',
        itemIndex: 5,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assess-progress-api.test.ts`
Expected: FAIL — module not found for `@/app/api/assess/progress/route`.

- [ ] **Step 3: Create the API route**

Create `src/app/api/assess/progress/route.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Lightweight POST endpoint for navigator.sendBeacon().
 * Called during beforeunload to flush pending progress updates.
 * Uses the same Postgres RPC as updateSessionProgressLite.
 */
export async function POST(request: Request) {
  let body: { token?: string; sessionId?: string; sectionId?: string; itemIndex?: number }
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { token, sessionId, sectionId, itemIndex } = body

  if (!token || !sessionId || !sectionId || itemIndex === undefined) {
    return new Response('Missing required fields', { status: 400 })
  }

  const db = createAdminClient()

  const { data, error } = await db.rpc('update_session_progress_for_session', {
    p_access_token: token,
    p_session_id: sessionId,
    p_current_section_id: sectionId,
    p_current_item_index: itemIndex,
  })

  if (error) {
    return new Response('Internal error', { status: 500 })
  }

  if (data === false) {
    return new Response('Forbidden', { status: 403 })
  }

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/assess-progress-api.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/assess/progress/route.ts tests/integration/assess-progress-api.test.ts
git commit -m "feat(assess): add sendBeacon progress endpoint for beforeunload flush"
```

---

### Task 4: Likert Scale Equal Sizing

**Files:**
- Modify: `src/components/assess/formats/likert-response.tsx`
- Create: `tests/components/likert-response.test.tsx`

- [ ] **Step 1: Write the component test**

Create `tests/components/likert-response.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LikertResponse } from '@/components/assess/formats/likert-response'

const FIVE_OPTIONS = [
  { id: '1', label: 'Strongly Disagree', value: 1 },
  { id: '2', label: 'Disagree', value: 2 },
  { id: '3', label: 'Neutral', value: 3 },
  { id: '4', label: 'Agree', value: 4 },
  { id: '5', label: 'Strongly Agree', value: 5 },
]

describe('LikertResponse', () => {
  it('renders all options as buttons', () => {
    render(<LikertResponse options={FIVE_OPTIONS} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.getByText('Strongly Disagree')).toBeDefined()
    expect(screen.getByText('Strongly Agree')).toBeDefined()
  })

  it('uses CSS Grid with equal columns for the option count', () => {
    const { container } = render(
      <LikertResponse options={FIVE_OPTIONS} onSelect={vi.fn()} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid')
    expect(grid.className).toContain('md:grid-cols-5')
  })

  it('adapts grid columns for 3 options', () => {
    const threeOptions = FIVE_OPTIONS.slice(0, 3)
    const { container } = render(
      <LikertResponse options={threeOptions} onSelect={vi.fn()} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('md:grid-cols-3')
  })

  it('marks the selected button with aria-pressed', () => {
    render(
      <LikertResponse options={FIVE_OPTIONS} selectedValue={3} onSelect={vi.fn()} />
    )
    const neutral = screen.getByText('Neutral')
    expect(neutral.getAttribute('aria-pressed')).toBe('true')
    const agree = screen.getByText('Agree')
    expect(agree.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onSelect with the option value on click', () => {
    const onSelect = vi.fn()
    render(<LikertResponse options={FIVE_OPTIONS} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Agree'))
    expect(onSelect).toHaveBeenCalledWith(4)
  })

  it('buttons have min-h-[56px] for adequate tap targets', () => {
    const { container } = render(
      <LikertResponse options={FIVE_OPTIONS} onSelect={vi.fn()} />
    )
    const buttons = container.querySelectorAll('button')
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[56px]')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/likert-response.test.tsx`
Expected: FAIL — grid class assertions fail (current code uses `flex`).

- [ ] **Step 3: Update the Likert component**

Replace the entire content of `src/components/assess/formats/likert-response.tsx`:

```tsx
"use client";

interface LikertResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

/** Static lookup to avoid Tailwind purge issues with dynamic class names. */
const GRID_COLS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
  7: "md:grid-cols-7",
};

/**
 * Likert scale response format.
 *
 * - Desktop (>=768px): CSS Grid with equal-width columns, all same height
 * - Mobile (<768px): vertical stack of full-width tap targets
 * - No numbers shown — only word labels
 * - Uses brand tokens for selection state
 */
export function LikertResponse({
  options,
  selectedValue,
  onSelect,
}: LikertResponseProps) {
  const gridCols = GRID_COLS[options.length] ?? "md:grid-cols-5";

  return (
    <div className={`grid grid-cols-1 gap-2 ${gridCols}`}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`
              grid place-items-center rounded-xl border-2 px-3 py-3
              text-sm font-medium transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              min-h-[56px]
              ${isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"}
            `}
            style={{
              borderColor: isSelected
                ? "var(--brand-primary, hsl(var(--primary)))"
                : "var(--brand-neutral-200, hsl(var(--border)))",
              background: isSelected
                ? "var(--brand-surface, hsl(var(--primary) / 0.08))"
                : "transparent",
              color: isSelected
                ? "var(--brand-primary, hsl(var(--primary)))"
                : "var(--brand-text, hsl(var(--foreground)))",
            }}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/likert-response.test.tsx`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/formats/likert-response.tsx tests/components/likert-response.test.tsx
git commit -m "fix(assess): use CSS Grid for equal-size Likert buttons with larger tap targets"
```

---

### Task 5: Save Queue Logic (Extractable & Testable)

The save queue is complex enough to warrant extraction as a testable module. This keeps `section-wrapper.tsx` focused on rendering.

**Files:**
- Create: `src/components/assess/use-save-queue.ts`
- Create: `tests/unit/use-save-queue.test.ts`

- [ ] **Step 1: Write the unit test**

Create `tests/unit/use-save-queue.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the server action
const mockSaveResponseLite = vi.fn()
vi.mock('@/app/actions/assess', () => ({
  saveResponseLite: (...args: unknown[]) => mockSaveResponseLite(...args),
}))

const { useSaveQueue } = await import('@/components/assess/use-save-queue')

describe('useSaveQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockSaveResponseLite.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('processes a single save successfully', async () => {
    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({
        itemId: 'item-1',
        sectionId: 'sec-1',
        value: 3,
      })
      // Let the queue drain
      await vi.waitFor(() => {
        expect(mockSaveResponseLite).toHaveBeenCalledTimes(1)
      })
    })

    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.saveError).toBe(false)
  })

  it('processes multiple saves in order', async () => {
    const callOrder: string[] = []
    mockSaveResponseLite.mockImplementation(async (input: { itemId: string }) => {
      callOrder.push(input.itemId)
      return { success: true }
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 1 })
      result.current.enqueueSave({ itemId: 'item-2', sectionId: 'sec-1', value: 2 })
      result.current.enqueueSave({ itemId: 'item-3', sectionId: 'sec-1', value: 3 })

      await vi.waitFor(() => {
        expect(mockSaveResponseLite).toHaveBeenCalledTimes(3)
      })
    })

    expect(callOrder).toEqual(['item-1', 'item-2', 'item-3'])
  })

  it('retries failed saves up to 3 times then moves to failed list', async () => {
    mockSaveResponseLite.mockResolvedValue({ error: 'network error' })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
    })

    // Advance through retry backoff delays (500ms, 1000ms)
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })

    // 1 initial attempt + 2 retries = 3 total calls
    expect(mockSaveResponseLite).toHaveBeenCalledTimes(3)
    expect(result.current.saveError).toBe(true)
  })

  it('retryFailedSaves re-enqueues failed entries', async () => {
    // First call fails 3 times, then succeeds on retry
    let callCount = 0
    mockSaveResponseLite.mockImplementation(async () => {
      callCount++
      if (callCount <= 3) return { error: 'fail' }
      return { success: true }
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    // Enqueue and let it fail 3 times
    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })

    expect(result.current.saveError).toBe(true)

    // Now retry — should succeed (callCount is now > 3)
    await act(async () => {
      result.current.retryFailedSaves()
    })

    expect(result.current.saveError).toBe(false)
    expect(result.current.saveStatus).toBe('saved')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/use-save-queue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the `useSaveQueue` hook**

Create `src/components/assess/use-save-queue.ts`:

```typescript
"use client";

import { useRef, useState, useCallback } from "react";
import { saveResponseLite } from "@/app/actions/assess";

type SaveEntry = {
  itemId: string;
  sectionId: string;
  value: number;
  data?: Record<string, unknown>;
  responseTimeMs?: number;
  retries?: number;
};

type SaveStatus = "idle" | "saving" | "saved";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useSaveQueue(config: { token: string; sessionId: string }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState(false);

  const queueRef = useRef<SaveEntry[]>([]);
  const failedRef = useRef<SaveEntry[]>([]);
  const isProcessingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setSaveStatus("saving");

    while (queueRef.current.length > 0) {
      const entry = queueRef.current[0];

      const result = await saveResponseLite({
        token: config.token,
        sessionId: config.sessionId,
        itemId: entry.itemId,
        sectionId: entry.sectionId,
        responseValue: entry.value,
        responseData: entry.data,
        responseTimeMs: entry.responseTimeMs,
      });

      if (result.error) {
        entry.retries = (entry.retries ?? 0) + 1;
        if (entry.retries >= 3) {
          failedRef.current.push(queueRef.current.shift()!);
          setSaveError(true);
        } else {
          await delay(500 * entry.retries);
        }
      } else {
        queueRef.current.shift();
      }
    }

    isProcessingRef.current = false;

    if (failedRef.current.length === 0) {
      setSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [config.token, config.sessionId]);

  const enqueueSave = useCallback(
    (entry: Omit<SaveEntry, "retries">) => {
      queueRef.current.push({ ...entry, retries: 0 });
      setSaveStatus("saving");
      processQueue();
    },
    [processQueue],
  );

  const retryFailedSaves = useCallback(() => {
    const failed = failedRef.current.splice(0);
    for (const entry of failed) {
      entry.retries = 0;
      queueRef.current.push(entry);
    }
    setSaveError(false);
    processQueue();
  }, [processQueue]);

  return { enqueueSave, retryFailedSaves, saveStatus, saveError };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/use-save-queue.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/assess/use-save-queue.ts tests/unit/use-save-queue.test.ts
git commit -m "feat(assess): add useSaveQueue hook with retry and failed-save retention"
```

---

### Task 6: Rewrite SectionWrapper — Optimistic Saves, Nav Lock, Debounced Progress

This is the main integration task. It rewires `section-wrapper.tsx` to use the new save queue, ref-based nav lock, and debounced progress updates.

**Files:**
- Modify: `src/components/assess/section-wrapper.tsx`

**Reference:** Read the spec sections 1, 3, 4 for the full design. Read the current file at `src/components/assess/section-wrapper.tsx` before making changes.

- [ ] **Step 1: Update imports**

In `src/components/assess/section-wrapper.tsx`, replace the imports from `@/app/actions/assess`:

Old:
```typescript
import {
  saveResponse,
  updateSessionProgress,
} from "@/app/actions/assess";
```

New:
```typescript
import { updateSessionProgressLite } from "@/app/actions/assess";
import { useSaveQueue } from "./use-save-queue";
```

- [ ] **Step 2: Add timing constants and new refs**

After the `CONTINUE_FORMATS` set (around line 50), add:

```typescript
/** Animation + auto-advance delay. Single source of truth. */
const ADVANCE_DELAY_MS = 120;

/** Debounce interval for session progress updates. */
const PROGRESS_DEBOUNCE_MS = 3000;
```

- [ ] **Step 3: Wire up the save queue hook**

Inside the `SectionWrapper` component, after `const router = useRouter();`, add:

```typescript
const { enqueueSave, retryFailedSaves, saveStatus, saveError } = useSaveQueue({
  token,
  sessionId,
});
```

Remove these lines (they're now handled by the hook):
- `const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");`
- `const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);`

The existing save status indicator JSX in the `<footer>` already references `saveStatus` — it will now bind to the hook's return value instead of the removed local state. No JSX changes needed for this; the variable name is the same. Also add `useEffect` to the React import at the top of the file: `import { useState, useCallback, useRef, useEffect } from "react";`

- [ ] **Step 4: Add ref-based navigation lock**

After the existing `const [isAnimating, setIsAnimating] = useState(false);`, add:

```typescript
const navLockRef = useRef(false);
```

Replace the existing `navigateToItem` callback with:

```typescript
const navigateToItem = useCallback(
  (newLocalIdx: number, direction: "left" | "right") => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    setSlideDirection(direction);
    setIsAnimating(true);

    setTimeout(() => {
      setLocalItemIndex(newLocalIdx);
      setIsAnimating(false);
      navLockRef.current = false;
    }, ADVANCE_DELAY_MS);
  },
  [],
);
```

- [ ] **Step 5: Add debounced progress updates**

After the `navLockRef`, add the progress debounce refs and functions:

```typescript
const progressTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
const pendingProgressRef = useRef<{ sectionId: string; itemIndex: number } | null>(null);

function scheduleProgressUpdate(sectionId: string, itemIndex: number) {
  pendingProgressRef.current = { sectionId, itemIndex };
  if (!progressTimerRef.current) {
    progressTimerRef.current = setTimeout(() => {
      flushProgress();
      progressTimerRef.current = null;
    }, PROGRESS_DEBOUNCE_MS);
  }
}

function flushProgress() {
  const pending = pendingProgressRef.current;
  if (!pending) return;
  pendingProgressRef.current = null;
  updateSessionProgressLite(token, sessionId, pending);
}
```

Add the `useEffect` for `beforeunload` and cleanup (add `useEffect` to the React import at top of file):

```typescript
useEffect(() => {
  const handler = () => {
    const pending = pendingProgressRef.current;
    if (!pending) return;
    pendingProgressRef.current = null;
    navigator.sendBeacon(
      "/api/assess/progress",
      JSON.stringify({ token, sessionId, ...pending }),
    );
  };
  window.addEventListener("beforeunload", handler);
  return () => {
    window.removeEventListener("beforeunload", handler);
    flushProgress();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [token, sessionId]);
```

- [ ] **Step 6: Rewrite `goToNextItem` to use `scheduleProgressUpdate` instead of `await updateSessionProgress`**

Replace the existing `goToNextItem` with:

```typescript
const goToNextItem = useCallback(() => {
  if (localItemIndex < section.items.length - 1) {
    navigateToItem(localItemIndex + 1, "left");
    scheduleProgressUpdate(section.id, localItemIndex + 1);
  } else if (sectionIndex < totalSections - 1) {
    scheduleProgressUpdate(section.id, localItemIndex);
    flushProgress(); // flush before navigating away
    router.push(`/assess/${token}/section/${sectionIndex + 1}`);
  } else {
    flushProgress();
    router.push(postAssessmentUrl);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleProgressUpdate/flushProgress
  // use refs internally; token/sessionId are stable for the session lifetime
}, [
  localItemIndex,
  section.items.length,
  section.id,
  sectionIndex,
  totalSections,
  token,
  postAssessmentUrl,
  router,
  navigateToItem,
]);
```

Note: `goToNextItem` is no longer `async` — progress updates are fire-and-forget. The `scheduleProgressUpdate` and `flushProgress` functions are plain functions that close over refs and stable props (`token`, `sessionId`), so they are intentionally omitted from the dependency array.

- [ ] **Step 7: Rewrite `handleResponse` to be optimistic**

Replace the existing `handleResponse` function with:

```typescript
function handleResponse(
  itemId: string,
  value: number,
  data?: Record<string, unknown>,
) {
  // 1. Optimistic local update (instant)
  setResponses((prev) => ({
    ...prev,
    [itemId]: { value, data: data ?? {} },
  }));

  // 2. Queue background save (non-blocking)
  enqueueSave({ itemId, sectionId: section.id, value, data });

  // 3. Auto-advance for single-select formats
  if (shouldAutoAdvance(responseFormatType, value, data)) {
    setTimeout(() => goToNextItem(), ADVANCE_DELAY_MS);
  }
}
```

- [ ] **Step 8: Add error banner to the JSX**

In the JSX, immediately after the `<header>` closing tag and before the progress bar, add:

```tsx
{/* Save error banner */}
{saveError && (
  <div
    className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm"
    style={{
      background: "var(--brand-error-surface, hsl(var(--destructive) / 0.1))",
      color: "var(--brand-error, hsl(var(--destructive)))",
    }}
  >
    <span>Some responses couldn&apos;t be saved. Check your connection.</span>
    <button
      onClick={retryFailedSaves}
      className="rounded-md px-3 py-1 text-xs font-semibold underline underline-offset-2"
    >
      Retry
    </button>
  </div>
)}
```

- [ ] **Step 9: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/assess/section-wrapper.tsx
git commit -m "feat(assess): optimistic saves, ref-based nav lock, debounced progress in section-wrapper"
```

---

### Task 7: Smoke Test — Build & Manual Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all existing tests**

Run: `npx vitest run`
Expected: All tests pass (no regressions).

- [ ] **Step 2: Run the development server**

Run: `npm run dev`
Navigate to an active assessment link on `assess.trajectas.com` (or `localhost:3000/assess/<token>/section/0`).

Verify:
- Clicking a Likert option advances to the next item almost instantly (~120ms)
- All 5 Likert buttons are the same width and height
- The "Saving..." indicator briefly appears then transitions to "Saved"
- Back button returns to the previous item with the previous response shown
- Changing a previous response and advancing forward works correctly
- Fast double-clicking does NOT cause double-advance
- The progress bar updates correctly

- [ ] **Step 3: Test offline resilience**

In browser DevTools → Network → set to "Offline":
- Click a few items — should still advance (optimistic)
- Error banner should appear after retry timeout
- Go back online → click "Retry" → saves should flush
- Status indicator returns to "Saved"

- [ ] **Step 4: Commit any fixups needed**

If any issues found, fix and commit with a descriptive message.
