'use client'

/**
 * Generate-and-ingest control surface.
 *
 * Nothing here decides anything. The seed and the per-family count go to
 * `generateAndIngestBank`, which runs the same generator the CLI runs and the
 * same ingest every other path uses; this component collects four values and
 * reports what came back.
 *
 * The result panel deliberately reports SKIPPED as prominently as INSERTED.
 * Ingest is idempotent by content hash, so re-running a seed is the supported
 * way to finish a partial load — and a run that inserts 0 and skips 84 is a
 * success, not a no-op to be puzzled over.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { generateAndIngestBank, type GenerateAndIngestResult } from '@/app/actions/item-bank'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type GenerateFormProps = {
  constructs: Array<{ id: string; name: string; itemCount: number }>
  responseFormats: Array<{ id: string; name: string; optionCount: number | null }>
}

const BAND_ORDER = ['easy', 'moderate', 'hard', 'very_hard'] as const
const BAND_LABEL: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  very_hard: 'Very hard',
}

export function GenerateForm({ constructs, responseFormats }: GenerateFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [seed, setSeed] = useState('')
  const [perFamily, setPerFamily] = useState('10')
  const [constructId, setConstructId] = useState(constructs[0]?.id ?? '')
  const [responseFormatId, setResponseFormatId] = useState(responseFormats[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateAndIngestResult | null>(null)

  const perFamilyNumber = Number.parseInt(perFamily, 10)
  const perFamilyValid = Number.isInteger(perFamilyNumber) && perFamilyNumber >= 1 && perFamilyNumber <= 20
  const ready = seed.trim().length > 0 && perFamilyValid && constructId !== '' && responseFormatId !== ''

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready || pending) return
    setError(null)
    setResult(null)

    startTransition(async () => {
      const outcome = await generateAndIngestBank({
        seed: seed.trim(),
        perFamily: perFamilyNumber,
        constructId,
        responseFormatId,
        purpose: 'construct',
      })

      if (!outcome.ok) {
        setError(outcome.error)
        toast.error(outcome.error)
        return
      }

      setResult(outcome.data)
      toast.success(
        outcome.data.itemsInserted > 0
          ? `${outcome.data.itemsInserted} items ingested as draft`
          : 'Bank already present — nothing written',
      )
      router.refresh()
    })
  }

  if (constructs.length === 0 || responseFormats.length === 0) {
    return (
      <Alert variant="warning">
        <AlertTitle>Nothing to generate into</AlertTitle>
        <AlertDescription>
          {constructs.length === 0
            ? 'No construct carries a figural-matrix family yet. A new construct for matrix items has to be introduced by a migration, so that the reason for it is written down.'
            : 'No response format of type “cognitive” exists. Ingest requires one; add it by migration.'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-5 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="seed">Seed</Label>
            <Input
              id="seed"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="pilot-2026-08-13"
              autoComplete="off"
              disabled={pending}
            />
            <p className="text-caption">
              Generation is deterministic. The same seed always produces the same items, so re-running
              one finishes a partial load rather than duplicating it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="per-family">Items per family</Label>
            <Input
              id="per-family"
              type="number"
              min={1}
              max={20}
              value={perFamily}
              onChange={(e) => setPerFamily(e.target.value)}
              className="tabular-nums"
              disabled={pending}
            />
            <p className="text-caption">
              Candidates attempted per family, before QA rejection. Ten families, so 10 here means up
              to 100 attempts. Maximum 20.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="construct">Construct</Label>
            <Select
              value={constructId}
              onValueChange={(value) => setConstructId(value ?? '')}
              disabled={pending}
            >
              <SelectTrigger id="construct">
                <SelectValue placeholder="Select a construct" />
              </SelectTrigger>
              <SelectContent>
                {constructs.map((construct) => (
                  <SelectItem key={construct.id} value={construct.id}>
                    {construct.name}
                    <span className="ml-2 text-caption tabular-nums">{construct.itemCount} items</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption">
              Only constructs that already hold figural-matrix items. Matrices are scored against a
              key; mixing them into a self-report construct would let a rollup average ratings with
              correctness.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="response-format">Response format</Label>
            <Select
              value={responseFormatId}
              onValueChange={(value) => setResponseFormatId(value ?? '')}
              disabled={pending}
            >
              <SelectTrigger id="response-format">
                <SelectValue placeholder="Select a response format" />
              </SelectTrigger>
              <SelectContent>
                {responseFormats.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    {format.name}
                    {format.optionCount ? (
                      <span className="ml-2 text-caption tabular-nums">{format.optionCount} options</span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption">
              Option count sets the blind-guess baseline every elimination-resistance gate is measured
              against — five options means .200.
            </p>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Generation failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!ready || pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {pending ? 'Generating…' : 'Generate and ingest'}
          </Button>
          <p className="text-caption">
            Every item lands as a draft. Nothing becomes takeable until it clears content and fairness
            review.
          </p>
        </div>
      </form>

      {result ? <ResultPanel result={result} onOpenRun={() => router.push('/cognitive-items/runs')} /> : null}
    </div>
  )
}

function ResultPanel({
  result,
  onOpenRun,
}: {
  result: GenerateAndIngestResult
  onOpenRun: () => void
}) {
  const rejections = Object.entries(result.rejectionReasons).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]">
      <p className="text-section font-medium">Run complete</p>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Generated" value={result.itemsGenerated} hint="Cleared every QA gate" />
        <Stat label="Inserted" value={result.itemsInserted} hint="New drafts written" />
        <Stat
          label="Skipped"
          value={result.itemsSkipped}
          hint="Already present, by content hash"
        />
        <Stat label="Families created" value={result.familiesCreated} />
      </div>

      <div className="space-y-2">
        <p className="text-overline text-[var(--gold)]">Difficulty prior bands</p>
        <div className="flex flex-wrap gap-2">
          {BAND_ORDER.map((band) => (
            <span
              key={band}
              className="rounded-md bg-[var(--cream)] px-2 py-1 text-caption dark:bg-foreground/[0.06]"
            >
              {BAND_LABEL[band]}{' '}
              <span className="font-medium tabular-nums">{result.bandDistribution[band] ?? 0}</span>
            </span>
          ))}
        </div>
        <p className="text-caption">
          A design prior from the rule model, not a measured value. Calibrated difficulty only exists
          after piloting.
        </p>
      </div>

      {rejections.length > 0 ? (
        <div className="space-y-2">
          <p className="text-overline text-[var(--gold)]">Candidates rejected by QA</p>
          <div className="flex flex-wrap gap-2">
            {rejections.map(([gate, count]) => (
              <span
                key={gate}
                className="rounded-md bg-[var(--cream)] px-2 py-1 text-caption font-mono dark:bg-foreground/[0.06]"
              >
                {gate} <span className="font-medium tabular-nums">{count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onOpenRun}>
          View generation runs
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-caption">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-caption">{hint}</p> : null}
    </div>
  )
}
