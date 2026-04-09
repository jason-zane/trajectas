# Assessment Runner Performance & Reliability

**Date:** 2026-04-09
**Status:** Draft
**Scope:** Participant-facing assessment experience (`assess.trajectas.com`)

## Problem

The assessment runner is unacceptably slow. Every item click triggers 6 sequential DB round-trips (auth re-validation × 2 actions + actual writes) before the next item appears. Combined with 550ms of animation delay, participants experience ~1–1.2s of latency per item. Over a 150-item assessment, that's 2.5+ minutes of pure waiting.

Additionally, race conditions cause bugs: responses from the previous item bleeding through, items failing to advance, and double-advances on fast clicks.

The Likert scale boxes render at unequal sizes because flexbox distributes space based on content width, causing labels like "Strongly Disagree" to wrap differently than "Neutral."

## Design

### 1. Optimistic Response Handling

**Current flow (blocking):**
```
Click → saveResponse() [~300ms] → setSaveStatus → wait 350ms → goToNextItem() → updateSessionProgress() [~200ms] → item appears
Total: ~850ms minimum
```

**New flow (optimistic):**
```
Click → update local state → advance item [~120ms animation] → item appears
         └→ background: saveResponse() [fire-and-forget with retry]
         └→ background: debounced updateSessionProgress()
Total: ~120ms perceived
```

**Timing constant:** Define `ADVANCE_DELAY_MS = 120` used for both the slide animation timeout and the auto-advance delay after selection. Single source of truth — no separate "selection flash" delay needed since the optimistic state update is instant.

**Implementation:**

In `section-wrapper.tsx`, restructure `handleResponse()`:

```typescript
function handleResponse(itemId: string, value: number, data?: Record<string, unknown>) {
  // 1. Optimistic local update (instant)
  setResponses(prev => ({ ...prev, [itemId]: { value, data: data ?? {} } }));

  // 2. Queue background save (non-blocking)
  enqueueSave({ itemId, sectionId: section.id, value, data });

  // 3. Auto-advance for single-select formats (no await)
  if (shouldAutoAdvance(responseFormatType, value, data)) {
    setTimeout(() => goToNextItem(), ADVANCE_DELAY_MS);
  }
}
```

The `enqueueSave` function manages a **save queue** with retry:

```typescript
// Save queue — processes saves sequentially to maintain order,
// retries failed saves up to 3 times with exponential backoff.
// Uses a ref-based queue so it survives re-renders.
const saveQueueRef = useRef<SaveEntry[]>([]);
const isProcessingRef = useRef(false);

async function enqueueSave(entry: SaveEntry) {
  saveQueueRef.current.push(entry);
  if (!isProcessingRef.current) processSaveQueue();
}

async function processSaveQueue() {
  isProcessingRef.current = true;
  while (saveQueueRef.current.length > 0) {
    const entry = saveQueueRef.current[0];
    const result = await saveResponseLite({ token, sessionId, ...entry });
    if (result.error) {
      entry.retries = (entry.retries ?? 0) + 1;
      if (entry.retries >= 3) {
        // Move to failed list (keep for retry), don't discard
        failedSavesRef.current.push(saveQueueRef.current.shift()!);
        setSaveError(true);
      } else {
        await delay(500 * entry.retries); // backoff
      }
    } else {
      saveQueueRef.current.shift();
    }
  }
  isProcessingRef.current = false;
  if (failedSavesRef.current.length === 0) {
    setSaveStatus("saved");
  }
}

// Retry failed saves — called from the error banner's Retry button.
// Re-enqueues all failed entries and re-processes.
function retryFailedSaves() {
  const failed = failedSavesRef.current.splice(0);
  for (const entry of failed) {
    entry.retries = 0;
    saveQueueRef.current.push(entry);
  }
  setSaveError(false);
  if (!isProcessingRef.current) processSaveQueue();
}
```

**Back-navigation with optimistic state:** When a participant goes back and changes their response, it simply overwrites the local `responses[itemId]` entry and enqueues a new save. The DB upsert on `(session_id, item_id)` handles the overwrite. No special logic needed — the queue processes saves in order, so the latest value wins.

### 2. Lightweight Server Actions (Remove Hot-Path Auth)

**Current problem:** Every `saveResponse()` and `updateSessionProgress()` call re-validates the access token by querying `campaign_participants` + `campaigns` + `participant_sessions` — 2-3 DB queries just for auth, before the actual write.

**Solution:** Create Postgres RPC functions that combine ownership validation + write in a **single DB round-trip**, then call them from lightweight server actions.

**Important:** The app uses `createAdminClient()` (service-role key) which bypasses RLS. We cannot rely on RLS for security — we must validate ownership explicitly. The current approach does this with 2-3 separate queries. The new approach does it in one round-trip via a Postgres function.

**Postgres function — `save_response_for_session`:**

```sql
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
  -- Single-query ownership check: token → participant → session
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
```

**Server action — `saveResponseLite`:**

```typescript
export async function saveResponseLite(input: {
  token: string;      // access token for ownership validation
  sessionId: string;
  itemId: string;
  sectionId: string;
  responseValue: number;
  responseData?: Record<string, unknown>;
  responseTimeMs?: number;
}) {
  const db = createAdminClient();

  const { data, error } = await db.rpc('save_response_for_session', {
    p_access_token: input.token,
    p_session_id: input.sessionId,
    p_item_id: input.itemId,
    p_section_id: input.sectionId,
    p_response_value: input.responseValue,
    p_response_data: input.responseData ?? {},
    p_response_time_ms: input.responseTimeMs ?? null,
  });

  if (error || data === false) {
    logActionError('saveResponseLite.rpc', error ?? 'ownership check failed');
    return { error: 'Unable to save response' };
  }
  return { success: true as const };
}
```

**Similarly, `update_session_progress_for_session`:**

```sql
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

**Security model:** The access token is still validated on every write — but the validation happens inside a single Postgres function call (1 DB round-trip) rather than across 2-3 separate queries. The `SECURITY DEFINER` functions run with elevated privileges but enforce the ownership check internally. The access token is passed from the client component (it already has it from the URL prop) through the server action to Postgres.

The original `saveResponse()` and `updateSessionProgress()` functions remain unchanged for any other callers that need full validation.

**Migration file:** `supabase/migrations/YYYYMMDD_assessment_runner_rpc.sql` containing both functions.

### 3. Debounce Session Progress Updates

**Current:** `updateSessionProgress()` fires on every item navigation, creating a DB write per item.

**New:** Debounce progress updates to fire at most once every 3 seconds. Progress is only needed for crash recovery (so the participant resumes at roughly the right item), so slight staleness is acceptable.

```typescript
const PROGRESS_DEBOUNCE_MS = 3000;
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
  // Fire-and-forget — progress is best-effort
  updateSessionProgressLite(token, sessionId, pending);
}

// Flush on page leave via sendBeacon (works during unload).
// Server actions can't be called during beforeunload (async fetch gets cancelled),
// so we hit a lightweight API route with sendBeacon instead.
useEffect(() => {
  const handler = () => {
    const pending = pendingProgressRef.current;
    if (!pending) return;
    pendingProgressRef.current = null;
    navigator.sendBeacon(
      '/api/assess/progress',
      JSON.stringify({ token, sessionId, ...pending })
    );
  };
  window.addEventListener('beforeunload', handler);
  return () => {
    window.removeEventListener('beforeunload', handler);
    flushProgress(); // normal unmount (e.g. section change) — use server action
  };
}, []);
```

**API route for sendBeacon:** Create `src/app/api/assess/progress/route.ts` — a minimal POST handler that calls the same Postgres RPC. This is only used for the `beforeunload` edge case; normal progress updates use the server action directly.

### 4. Navigation Lock (Fix Race Conditions)

**Current bug:** `isAnimating` is React state, so it's stale inside `setTimeout` callbacks. Fast double-clicks can trigger two advances.

**Fix:** Use a `useRef` for the navigation lock instead of state:

```typescript
const navLockRef = useRef(false);

const navigateToItem = useCallback((newLocalIdx: number, direction: "left" | "right") => {
  if (navLockRef.current) return;
  navLockRef.current = true;
  setSlideDirection(direction);
  setIsAnimating(true);  // still used for CSS class

  setTimeout(() => {
    setLocalItemIndex(newLocalIdx);
    setIsAnimating(false);
    navLockRef.current = false;
  }, ADVANCE_DELAY_MS);
}, []);
```

The ref-based lock is synchronous — it prevents double-advance regardless of React's batching schedule.

### 5. Likert Scale: Equal Sizing

**Current:** `flex-1` in a `flex-row` — buttons are equal width but unequal height since text wrapping varies.

**Fix:** Switch to CSS Grid with explicit equal columns and a shared minimum height:

```tsx
// Desktop: equal-width grid columns, all same height
// Mobile: vertical stack, full width
<div className="grid grid-cols-1 gap-2 md:grid-cols-5 md:gap-2">
  {options.map((option) => (
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
      style={{/* same brand styles */}}
      aria-pressed={isSelected}
    >
      {option.label}
    </button>
  ))}
</div>
```

Key changes:
- `grid-cols-5` forces all 5 columns to identical width (and grid rows align height automatically)
- `min-h-[56px]` (up from 44px) — gives enough room for 2-line labels like "Strongly Disagree" without needing a third line at most screen widths
- `place-items-center` centers text both horizontally and vertically within each cell
- Dynamic column count via a static lookup map (avoids Tailwind purge issues):
  ```typescript
  const GRID_COLS: Record<number, string> = {
    2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4",
    5: "md:grid-cols-5", 6: "md:grid-cols-6", 7: "md:grid-cols-7",
  };
  // Usage: className={`grid grid-cols-1 gap-2 ${GRID_COLS[options.length] ?? "md:grid-cols-5"}`}
  ```

### 6. Save Status Indicator Update

With optimistic saves, the status indicator logic changes:

- **"Saving..."** — shown when the save queue has pending items
- **"Saved"** — shown for 2s after queue drains
- **Error state** — persistent banner if saves fail after retries: "Some responses couldn't be saved. Please check your connection."
- **Idle** — "Responses saved automatically" (same as current)

### 7. Error Recovery

If the save queue fails (3 retries exhausted), show a non-dismissible banner at the top of the runner:

```
⚠ Some responses couldn't be saved. Please check your connection and try again.
[Retry] button
```

The retry button re-processes the failed queue entries. The participant can continue answering (responses are in local state) — the saves will flush once connectivity is restored.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/assess/section-wrapper.tsx` | Optimistic response handling, save queue, debounced progress, nav lock |
| `src/components/assess/formats/likert-response.tsx` | Grid layout, larger boxes, equal sizing |
| `src/app/actions/assess.ts` | Add `saveResponseLite()` and `updateSessionProgressLite()` server actions |
| `src/app/api/assess/progress/route.ts` | **New** — sendBeacon endpoint for beforeunload progress flush |
| `supabase/migrations/YYYYMMDD_assessment_runner_rpc.sql` | **New** — Postgres RPC functions for single-roundtrip auth+write |
| `src/lib/auth/participant-runtime.ts` | No changes (existing functions untouched) |
| `src/components/assess/item-card.tsx` | No changes expected |

## What This Does NOT Cover

- **General platform backend speed** — the dashboard side has its own performance issues (query waterfalls, missing indexes). That's a separate investigation.
- **Report generation reliability** — the fire-and-forget pattern for report gen needs retry/queue, but that doesn't affect the participant experience during the assessment.
- **Prefetching between assessment intros** — cross-section navigation uses `router.push()` which triggers a full server render. Could be improved with prefetch hints, but the within-section experience (95% of clicks) is where the pain is.

## Success Criteria

- Item-to-item transition feels instant (< 200ms perceived latency)
- No response data bugs (previous item responses don't bleed through)
- No double-advance on fast clicks
- Likert boxes visually identical in size across all 5 options
- Failed saves surface clearly to the participant with retry option
- Back-navigation works correctly with changed responses
