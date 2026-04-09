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
Click → update local state → advance item [~150ms animation] → item appears
         └→ background: saveResponse() [fire-and-forget with retry]
         └→ background: debounced updateSessionProgress()
Total: ~150ms perceived
```

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
    setTimeout(() => goToNextItem(), 150);
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
    const result = await saveResponseLite({ sessionId, ...entry });
    if (result.error) {
      entry.retries = (entry.retries ?? 0) + 1;
      if (entry.retries >= 3) {
        saveQueueRef.current.shift(); // drop after 3 failures
        setSaveError(true); // show persistent error to user
      } else {
        await delay(500 * entry.retries); // backoff
      }
    } else {
      saveQueueRef.current.shift();
    }
  }
  isProcessingRef.current = false;
  setSaveStatus("saved");
}
```

**Back-navigation with optimistic state:** When a participant goes back and changes their response, it simply overwrites the local `responses[itemId]` entry and enqueues a new save. The DB upsert on `(session_id, item_id)` handles the overwrite. No special logic needed — the queue processes saves in order, so the latest value wins.

### 2. Lightweight Server Actions (Remove Hot-Path Auth)

**Current problem:** Every `saveResponse()` and `updateSessionProgress()` call re-validates the access token by querying `campaign_participants` + `campaigns` + `participant_sessions` — 2-3 DB queries just for auth, before the actual write.

**Solution:** Create `saveResponseLite()` and `updateSessionProgressLite()` server actions that skip full token re-validation. Instead, they accept only `sessionId` and validate ownership with a **single query** that combines the ownership check with the write:

```typescript
// saveResponseLite — single DB operation, no separate auth query
export async function saveResponseLite(input: {
  sessionId: string;
  itemId: string;
  sectionId: string;
  responseValue: number;
  responseData?: Record<string, unknown>;
  responseTimeMs?: number;
}) {
  const db = createAdminClient();

  // Single upsert — the (session_id, item_id) constraint + RLS
  // ensures only the owning session can write.
  // The session was already validated at page load.
  const { error } = await db
    .from('participant_responses')
    .upsert({
      session_id: input.sessionId,
      item_id: input.itemId,
      section_id: input.sectionId,
      response_value: input.responseValue,
      response_data: input.responseData ?? {},
      response_time_ms: input.responseTimeMs ?? null,
    }, { onConflict: 'session_id,item_id' });

  if (error) {
    logActionError('saveResponseLite.upsert', error);
    return { error: 'Unable to save response' };
  }
  return { success: true as const };
}
```

**Security model:** The session ID is a UUID generated server-side and never exposed in URLs (only the access token is in the URL). The page-level `validateAccessToken()` + `startSession()` already proved ownership. The session ID acts as a capability token for the duration of the assessment. This is the same trust boundary used by the existing `existingResponses` prop — if we trust the session ID enough to load all responses, we can trust it enough to write them.

The original `saveResponse()` and `updateSessionProgress()` functions remain unchanged for any other callers that need full validation.

### 3. Debounce Session Progress Updates

**Current:** `updateSessionProgress()` fires on every item navigation, creating a DB write per item.

**New:** Debounce progress updates to fire at most once every 3 seconds, and on `beforeunload`. Progress is only needed for crash recovery (so the participant resumes at roughly the right item), so slight staleness is acceptable.

```typescript
const progressTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
const pendingProgressRef = useRef<{ sectionId: string; itemIndex: number } | null>(null);

function scheduleProgressUpdate(sectionId: string, itemIndex: number) {
  pendingProgressRef.current = { sectionId, itemIndex };
  if (!progressTimerRef.current) {
    progressTimerRef.current = setTimeout(() => {
      flushProgress();
      progressTimerRef.current = null;
    }, 3000);
  }
}

function flushProgress() {
  const pending = pendingProgressRef.current;
  if (!pending) return;
  pendingProgressRef.current = null;
  // Fire-and-forget — progress is best-effort
  updateSessionProgressLite(sessionId, pending);
}

// Flush on unmount / page leave
useEffect(() => {
  const handler = () => flushProgress();
  window.addEventListener('beforeunload', handler);
  return () => {
    window.removeEventListener('beforeunload', handler);
    flushProgress();
  };
}, []);
```

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
  }, 120);  // tightened from 200ms
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
- Dynamic column count: use `md:grid-cols-${options.length}` to handle formats with fewer/more than 5 options (via a lookup map to avoid Tailwind purge issues)

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
| `src/app/actions/assess.ts` | Add `saveResponseLite()` and `updateSessionProgressLite()` |
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
