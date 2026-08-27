/**
 * The reviewer's view of a cognitive item (#347 scope item 2).
 *
 * ===========================================================================
 * THIS IS A SERVER COMPONENT AND MUST STAY ONE
 * ===========================================================================
 * It renders KEY MATERIAL: which option is correct, and the per-distractor
 * error labels. `tests/architecture/admin-answer-key-isolation.test.ts` forbids
 * any `'use client'` module from importing `@/lib/dal/item-bank-review`,
 * precisely because typing a client component's props with `ItemForReview` puts
 * `keyOptionId` and every `errorLabel` into the browser payload. Adding
 * `'use client'` to this file is the mistake that guard exists to catch.
 *
 * Everything here is static markup — there is no state and no handler, so
 * nothing needs the client anyway.
 *
 * ---------------------------------------------------------------------------
 * Fidelity: "exactly as the candidate sees it"
 * ---------------------------------------------------------------------------
 * `gridSvg` and each `optionSvg` come from `getCognitiveItemsForDelivery` —
 * the participant runner's own renderer, reached through
 * `src/lib/dal/item-bank-review.ts`. The geometry below mirrors
 * `src/components/assess/formats/cognitive-response.tsx`: a 3-column grid, the
 * eight rendered cells injected through a `display: contents` wrapper so they
 * become direct grid children, and the blank "?" ninth cell drawn here as UI
 * chrome exactly as the runner draws it.
 *
 * The runner's `--runner-*` colour tokens are brand-derived and normally
 * injected at `:root` by the /assess layout, which the dashboard does not have.
 * Rather than approximate them with admin colours, this component resolves the
 * real brand tokens and applies them as INLINE custom properties scoped to the
 * preview container — so the reviewer sees the delivered appearance without
 * those tokens leaking into the surrounding admin page.
 *
 * `dangerouslySetInnerHTML` carries the same safety argument as the runner:
 * both SVG strings are produced server-side by a pure renderer reading a
 * zod-`.strict()`-validated closed vocabulary. No free text, no user input.
 */

import { AlertTriangle, Info, KeyRound } from 'lucide-react'
import type { CSSProperties } from 'react'
import { getCachedEffectiveBrand } from '@/app/actions/brand'
import { generateRunnerTokens } from '@/lib/brand/runner-tokens'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { errorLabelDisplay } from '../../lifecycle-display'

/**
 * Props are declared structurally rather than as `ItemForReview` so this
 * component states exactly which key-bearing fields it renders.
 */
export type PreviewOption = {
  optionId: string
  slot: string
  label: string
  optionSvg: string | null
  isKey: boolean
  errorLabel: string | null
  errorRationale: string | null
}

export async function ItemPreview({
  gridSvg,
  ariaLabel,
  options,
  keyRationale,
}: {
  gridSvg: string | null
  ariaLabel: string | null
  options: PreviewOption[]
  keyRationale: string | null
}) {
  const brand = await getCachedEffectiveBrand()
  const { tokens } = generateRunnerTokens(brand)
  const runnerStyle = tokens as unknown as CSSProperties

  const distractors = options.filter((option) => !option.isKey)
  // The honest distinction #347 needs a reviewer to be able to make:
  // "this item has no recorded distractor rationale at all" is a DIFFERENT
  // finding from "this particular distractor has no label". The first is a
  // gap in what was ingested; the second is a gap in one option's design.
  const hasAnyErrorLabel = distractors.some((option) => option.errorLabel !== null)
  const hasKey = options.some((option) => option.isKey)

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-6 ring-1 ring-foreground/[0.06]"
        style={{ ...runnerStyle, background: 'var(--runner-page)' }}
      >
        <p
          className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--runner-text-faint)' }}
        >
          As delivered
        </p>

        {gridSvg ? (
          <div
            role="img"
            aria-label={ariaLabel ?? 'Figural matrix stimulus'}
            className="grid grid-cols-3 gap-1.5 sm:gap-2"
            style={{ maxWidth: 420 }}
          >
            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: gridSvg }} />
            <div
              aria-hidden="true"
              className="flex items-center justify-center text-2xl font-semibold"
              style={{
                aspectRatio: '1 / 1',
                borderRadius: '6px',
                border: '1px dashed var(--runner-ghost-border)',
                color: 'var(--runner-text-faint)',
              }}
            >
              ?
            </div>
          </div>
        ) : (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Stimulus could not be rendered</AlertTitle>
            <AlertDescription>
              This item has no renderable cognitive spec, so there is nothing to show a candidate.
              That is itself a review finding — do not sign it off.
            </AlertDescription>
          </Alert>
        )}

        {options.length > 0 ? (
          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3" style={{ maxWidth: 420 }}>
            {options.map((option) => (
              <div key={option.optionId} className="space-y-1.5">
                {/* The tile itself is unannotated — pixel-for-pixel what the
                    candidate sees. Review annotation sits below it. */}
                <div
                  className="flex items-center justify-center p-1.5"
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: '10px',
                    border: '1px solid var(--runner-ghost-border)',
                    backgroundColor: 'var(--runner-ghost-fill)',
                  }}
                >
                  {option.optionSvg ? (
                    <div
                      className="size-full"
                      dangerouslySetInnerHTML={{ __html: option.optionSvg }}
                    />
                  ) : (
                    <span style={{ color: 'var(--runner-text)' }}>{option.label}</span>
                  )}
                </div>
                <p
                  className="text-center font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: 'var(--runner-text-faint)' }}
                >
                  {option.slot}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Key and distractor rationale — admin chrome, not delivered       */}
      {/* --------------------------------------------------------------- */}
      <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-[var(--gold)]" />
          <p className="text-section font-medium">Key and distractor rationale</p>
        </div>

        {!hasKey ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>No answer key recorded</AlertTitle>
            <AlertDescription>
              None of this item&rsquo;s options is marked correct. It cannot be scored and must not
              be promoted.
            </AlertDescription>
          </Alert>
        ) : null}

        <ul className="divide-y divide-border/60">
          {options.map((option) => {
            const error = option.errorLabel ? errorLabelDisplay(option.errorLabel) : null
            return (
              <li key={option.optionId} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold">
                  {option.slot}
                </span>
                <div className="min-w-0 flex-1">
                  {option.isKey ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-4xl bg-[var(--emerald)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--emerald-dark)]">
                        <KeyRound className="size-3" />
                        Key
                      </span>
                      {keyRationale ? (
                        <p className="text-caption mt-1 text-muted-foreground">{keyRationale}</p>
                      ) : null}
                    </>
                  ) : error ? (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded-4xl bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-semibold">
                          {option.errorLabel}
                        </span>
                        <span className="text-sm font-medium">{error.name}</span>
                      </span>
                      <p className="text-caption mt-1 text-muted-foreground">
                        {option.errorRationale ?? error.description}
                      </p>
                    </>
                  ) : hasAnyErrorLabel ? (
                    // Some distractors on this item DO carry labels, so this
                    // one's absence is specific to it.
                    <span className="text-caption text-muted-foreground">
                      Distractor — no error label recorded for this option.
                    </span>
                  ) : (
                    <span className="text-caption text-muted-foreground">Distractor</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {!hasAnyErrorLabel && distractors.length > 0 ? (
          <Alert variant="warning">
            <Info />
            <AlertTitle>No distractor rationale was recorded for this item</AlertTitle>
            <AlertDescription>
              This is an absence of data, not a finding that the distractors are error-free. The
              generator does classify every distractor by mechanism, but it narrows each placed
              option to <code className="font-mono text-[0.8em]">{'{ slot, elements }'}</code>{' '}
              before writing its output, so the labels never reach the bank file and no diagnostics
              rows were ingested. Judge these distractors on what you can see above; do not record a
              content sign-off that assumes a rationale you have not read.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  )
}
