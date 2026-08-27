'use client'

/**
 * The review workflow control surface (#347 scope item 3).
 *
 * ===========================================================================
 * REDACTED PROPS — DO NOT TYPE THESE AS `ItemForReview`
 * ===========================================================================
 * This is a client component, so every prop it declares is serialised into the
 * browser payload. `ItemForReview` carries `keyOptionId` and every distractor's
 * `errorLabel`; typing this component with it would ship the answer key to the
 * client. `tests/architecture/admin-answer-key-isolation.test.ts` fails the
 * build if this file imports that DAL, even for types. The key-bearing render
 * lives in ./item-preview.tsx, which is a server component.
 *
 * Everything below is lifecycle and sign-off state. None of it reveals the key.
 *
 * ---------------------------------------------------------------------------
 * Where the rules come from
 * ---------------------------------------------------------------------------
 *   - WHICH TRANSITIONS EXIST: `legalTransitions`, passed in from
 *     `getItemLifecycleTransitions()`, which reads the same database function
 *     the enforcing trigger consults. There is no transition list in this file.
 *   - WHICH SIGN-OFFS A TRANSITION NEEDS: `signOffBlockers()` from
 *     ../../signoff-policy, an advisory mirror of `items_review_signoff_guard()`
 *     that is pinned to the migration by a unit test. It decides what to
 *     DISABLE and EXPLAIN; it never decides what is allowed.
 *   - THE VERDICT: the database. A transition that this UI believes is fine can
 *     still be refused, and the guard's message is surfaced verbatim rather
 *     than reworded.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Loader2, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'

import { recordItemReview, transitionItemLifecycle } from '@/app/actions/item-bank'
// Pure zod schema module — no server-only imports, safe in a client bundle.
import type { TransitionItemLifecycleInput } from '@/lib/validations/item-bank'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/formatting'
import { lifecycleDisplay } from '../../lifecycle-display'
import {
  signOffBlockers,
  signOffKindLabel,
  type ReviewKind,
  type SignOffGateState,
} from '../../signoff-policy'

export type SignOffView = {
  present: boolean
  approved: boolean
  matchesCurrentContent: boolean
  reviewer: string | null
  reviewedAt: string | null
  notes: string | null
}

export const ABSENT_SIGN_OFF: SignOffView = {
  present: false,
  approved: false,
  matchesCurrentContent: false,
  reviewer: null,
  reviewedAt: null,
  notes: null,
}

export type ReviewPanelProps = {
  itemId: string
  lifecycleState: string
  contentSignOff: SignOffView
  fairnessSignOff: SignOffView
  /** Legal next states, read from the database. Empty means terminal. */
  legalTransitions: string[]
}

function toGate(view: SignOffView): SignOffGateState {
  return {
    present: view.present,
    approved: view.approved,
    matchesCurrentContent: view.matchesCurrentContent,
  }
}

function SignOffCard({
  kind,
  view,
  itemId,
  disabled,
  onDone,
}: {
  kind: ReviewKind
  view: SignOffView
  itemId: string
  disabled: boolean
  onDone: () => void
}) {
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const label = signOffKindLabel(kind)

  function submit(decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await recordItemReview({
        itemId,
        reviewKind: kind,
        decision,
        notes: notes.trim() ? notes.trim() : undefined,
      })
      if (result.ok) {
        toast.success(`${label} review recorded`)
        setNotes('')
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  const status = !view.present
    ? { text: 'Not reviewed', tone: 'bg-muted text-muted-foreground', icon: null }
    : !view.approved
      ? { text: 'Rejected', tone: 'bg-destructive/10 text-destructive', icon: <X className="size-3" /> }
      : !view.matchesCurrentContent
        ? {
            text: 'Stale — content changed',
            tone: 'bg-[var(--gold)]/15 text-[var(--emerald-dark)]',
            icon: <AlertTriangle className="size-3" />,
          }
        : {
            text: 'Approved',
            tone: 'bg-[var(--emerald)]/10 text-[var(--emerald-dark)]',
            icon: <Check className="size-3" />,
          }

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-section font-medium">{label} sign-off</p>
          <p className="text-caption text-muted-foreground">
            {kind === 'content'
              ? 'Is the item correct, unambiguous and solvable as designed?'
              : 'Is the item free of bias, and accessible to every candidate group?'}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-4xl px-2 py-0.5 text-xs font-medium',
            status.tone,
          )}
        >
          {status.icon}
          {status.text}
        </span>
      </div>

      {view.present ? (
        <div className="text-caption space-y-0.5 text-muted-foreground">
          <p>
            {view.reviewer ?? 'Unknown reviewer'} · {formatDateTime(view.reviewedAt)}
          </p>
          {view.notes ? <p className="italic">&ldquo;{view.notes}&rdquo;</p> : null}
          {view.approved && !view.matchesCurrentContent ? (
            <p className="text-[var(--emerald-dark)]">
              The item&rsquo;s content changed after this sign-off, so it no longer counts. Re-review
              to restore it.
            </p>
          ) : null}
        </div>
      ) : null}

      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder={`Optional note for this ${kind} decision`}
        rows={2}
        disabled={disabled || pending}
        aria-label={`${label} review notes`}
      />

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={disabled || pending} onClick={() => submit('approved')}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || pending}
          onClick={() => submit('rejected')}
        >
          <X className="size-4" />
          Reject
        </Button>
      </div>
    </div>
  )
}

export function ReviewPanel({
  itemId,
  lifecycleState,
  contentSignOff,
  fairnessSignOff,
  legalTransitions,
}: ReviewPanelProps) {
  const router = useRouter()
  const [pendingState, setPendingState] = useState<string | null>(null)
  const [guardMessage, setGuardMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const gate: Record<ReviewKind, SignOffGateState> = {
    content: toGate(contentSignOff),
    fairness: toGate(fairnessSignOff),
  }

  function transition(targetState: string) {
    setPendingState(targetState)
    setGuardMessage(null)
    startTransition(async () => {
      const result = await transitionItemLifecycle({
        itemId,
        // `targetState` originates from the database transition graph, which is
        // typed as plain strings because that is what it is — the set of legal
        // states lives in SQL, not in this union. The action re-validates with
        // zod and returns a normal `{ ok: false }` for anything unrecognised,
        // so this assertion cannot turn a bad state into a bad write.
        targetState: targetState as TransitionItemLifecycleInput['targetState'],
      })
      setPendingState(null)
      if (result.ok) {
        toast.success(`Moved to ${lifecycleDisplay(result.data.lifecycleState).label}`)
        router.refresh()
      } else {
        // The database guards raise messages written for a human. Show the
        // verdict as-is rather than translating it into a second vocabulary.
        setGuardMessage(result.error)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SignOffCard
          kind="content"
          view={contentSignOff}
          itemId={itemId}
          disabled={pendingState !== null}
          onDone={() => router.refresh()}
        />
        <SignOffCard
          kind="fairness"
          view={fairnessSignOff}
          itemId={itemId}
          disabled={pendingState !== null}
          onDone={() => router.refresh()}
        />
      </div>

      <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <p className="text-section font-medium">Lifecycle</p>
          <span className="text-caption text-muted-foreground">
            currently {lifecycleDisplay(lifecycleState).label}
          </span>
        </div>

        {guardMessage ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>The database refused this transition</AlertTitle>
            <AlertDescription>{guardMessage}</AlertDescription>
          </Alert>
        ) : null}

        {legalTransitions.length === 0 ? (
          <p className="text-caption text-muted-foreground">
            No transitions are available out of {lifecycleDisplay(lifecycleState).label.toLowerCase()}.
          </p>
        ) : (
          <ul className="space-y-2">
            {legalTransitions.map((target) => {
              const blockers = signOffBlockers(target, gate)
              const blocked = blockers.length > 0
              const display = lifecycleDisplay(target)
              return (
                <li
                  key={target}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{display.label}</p>
                    <p className="text-caption text-muted-foreground">{display.description}</p>
                    {blocked ? (
                      <ul className="mt-1 space-y-0.5">
                        {blockers.map((blocker) => (
                          <li
                            key={`${blocker.kind}-${blocker.reason}`}
                            className="text-caption flex items-center gap-1.5 text-destructive"
                          >
                            <AlertTriangle className="size-3 shrink-0" />
                            {blocker.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant={blocked ? 'outline' : 'default'}
                    disabled={blocked || pendingState !== null}
                    title={
                      blocked
                        ? blockers.map((blocker) => blocker.message).join(' ')
                        : `Move this item to ${display.label}`
                    }
                    onClick={() => transition(target)}
                  >
                    {pendingState === target ? <Loader2 className="size-4 animate-spin" /> : null}
                    Move to {display.label}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
