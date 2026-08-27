/**
 * The path from "a generated puzzle" to "a test someone can sit".
 *
 * ---------------------------------------------------------------------------
 * WHY A NAVIGATION STRIP EARNS ITS SPACE ON THIS PAGE
 * ---------------------------------------------------------------------------
 * The cognitive bank is four screens spread across two areas of the app, and
 * the names do not tell you which one to open:
 *
 *   - `/cognitive-items` lists FAMILIES, not items. Somebody looking for "the 98
 *     puzzles I generated" lands here and sees ten rows.
 *   - `/cognitive-items/review/[itemId]` is the ONLY screen that draws the matrix.
 *     Nothing about the word "review" says "this is where you look at it".
 *   - `/items` is the separate Likert library — 400+ self-report statements,
 *     no puzzles. It is the most natural place to go looking, and it is wrong.
 *   - The assessment that delivers the items is built under `/assessments`,
 *     which has no link back to the bank.
 *
 * Every one of those is a reasonable screen with an unreasonable name, and the
 * cost lands on whoever is holding the whole model in their head. This strip
 * states the order once, on the page you actually arrive at, with the counts
 * attached so you can see which step you are standing on.
 *
 * Deliberately not clickable cards: these are steps in a sequence, and a grid
 * of tiles reads as four alternatives rather than one order.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ItemLifecycleState } from '@/lib/dal/item-bank-admin'

/** The states in which an item may actually be served to a respondent. */
const SERVABLE_STATES: readonly ItemLifecycleState[] = ['piloting', 'calibrated', 'operational']

interface Step {
  title: string
  href: string
  description: string
  /** Short right-aligned state, e.g. "98 waiting". Omitted when not useful. */
  status?: string
}

function buildSteps(
  itemCount: number,
  lifecycleCounts: Record<string, number>,
): Step[] {
  const draft = lifecycleCounts.draft ?? 0
  const servable = SERVABLE_STATES.reduce((sum, s) => sum + (lifecycleCounts[s] ?? 0), 0)

  return [
    {
      title: 'Generate the items',
      href: '/cognitive-items/generate',
      description:
        'Pick a construct and a count. Re-running the same seed completes a partial load rather than duplicating it.',
      status: itemCount > 0 ? `${itemCount} in the bank` : undefined,
    },
    {
      title: 'Look at each one, and sign it off',
      href: '/cognitive-items/review',
      description:
        'Open any row to see the puzzle drawn full size, its five options, the keyed answer and what each wrong answer is meant to catch. Content and fairness are recorded separately, and an item needs both.',
      status: draft > 0 ? `${draft} awaiting review` : 'nothing waiting',
    },
    {
      title: 'Put the construct in a factor',
      href: '/factors',
      description:
        'The assessment builder lists factors, not constructs. Figural Matrix Reasoning needs to sit inside one, and that factor has to be past draft, before it can be picked.',
    },
    {
      title: 'Build the assessment',
      href: '/assessments',
      description:
        'Add the factor, set Scoring to “Ability — right/wrong”, and mark the first section as Practice. Only signed-off items can be placed; the rest are refused at the point of linking.',
      status: servable > 0 ? `${servable} placeable` : 'none placeable yet',
    },
  ]
}

export function HowItWorks({
  itemCount,
  lifecycleCounts,
}: {
  itemCount: number
  lifecycleCounts: Record<string, number>
}) {
  const steps = buildSteps(itemCount, lifecycleCounts)

  return (
    <section
      aria-labelledby="bank-how-it-works"
      className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]"
    >
      <div className="border-b border-foreground/[0.06] px-4 py-3">
        <p id="bank-how-it-works" className="text-section font-medium">
          From a generated item to a test someone can sit
        </p>
        <p className="text-caption text-muted-foreground">
          Four steps, in this order. The puzzles are drawn on step two —{' '}
          <Link href="/cognitive-items/review" className="underline underline-offset-2">
            open any row in the review queue
          </Link>
          . This page lists families; <span className="font-medium">/items</span> is the separate
          self-report library and holds none of them.
        </p>
      </div>

      <ol className="divide-y divide-foreground/[0.06]">
        {steps.map((step, index) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="group/step relative flex items-start gap-3 px-4 py-3 transition-colors duration-200 hover:bg-[var(--cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-[var(--gold)] transition-transform duration-200 group-hover/step:scale-y-100"
              />
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold">{step.title}</span>
                  {step.status ? (
                    <span className="text-caption tabular-nums text-muted-foreground">
                      {step.status}
                    </span>
                  ) : null}
                </span>
                <span className="block text-body text-muted-foreground">{step.description}</span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/step:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
