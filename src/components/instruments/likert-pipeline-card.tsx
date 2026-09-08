'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { advanceLikertBuildAction } from '@/app/actions/instrument-likert'
import { MAX_ROUNDS, type LikertStatus } from '@/lib/instrument/likert/contracts'

export function LikertPipelineCard({ buildId, initial }: { buildId: string; initial: LikertStatus }) {
  const router = useRouter()
  const [status, setStatus] = useState(initial)
  const [running, setRunning] = useState(!initial.ready && initial.phase !== 'incomplete')
  const [error, setError] = useState<string | null>(null)
  const resume = useRef(false)

  useEffect(() => {
    if (!running) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let consecutiveErrors = 0
    async function step() {
      try {
        const next = await advanceLikertBuildAction(buildId, resume.current)
        if (cancelled) return
        resume.current = false
        setStatus(next)
        setError(null)
        consecutiveErrors = 0
        if (next.ready || next.phase === 'incomplete') {
          setRunning(false)
          router.refresh()
          return
        }
        timer = setTimeout(() => { void step() }, next.busy ? 5000 : 250)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'The last step could not finish.'
        setError(message)
        consecutiveErrors++
        if (consecutiveErrors < 3) timer = setTimeout(() => { void step() }, 5000 * consecutiveErrors)
        else setRunning(false)
      }
    }
    void step()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [buildId, router, running])

  return <Card className="space-y-4 p-6" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">Automatic Likert creation</h2>
        <p className="text-sm text-muted-foreground">{status.detail}</p>
      </div>
      <Badge variant={status.ready ? 'default' : 'secondary'}>{status.ready ? 'AI review complete' : `Round ${status.round} of ${status.roundLimit ?? MAX_ROUNDS}`}</Badge>
    </div>
    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
      {[[status.totalCandidates, 'Candidates'], [status.reviewed, 'Reviewed by all three models'], [status.passed, 'Passed item checks'], [`${status.selected} / ${status.target}`, 'Selected for the form']].map(([value, label]) => <div key={String(label)}><div className="text-lg font-medium tabular-nums">{value}</div><div className="text-muted-foreground">{label}</div></div>)}
    </div>
    {!!status.pairsRequired && <p className="text-sm">Final-form pairs checked: {status.pairsChecked} / {status.pairsRequired}.</p>}
    <p className="text-sm text-muted-foreground">Three separately prompted models check construct fit, wording, fairness, response interpretation and scoring direction. Weak items are rewritten or replaced automatically. Final selection checks facet coverage, reverse keys and redundant wording.</p>
    {status.ready ? <p className="text-sm">This form completed its current AI checks. Reliability, norms and subgroup measurement equivalence remain unmeasured until respondent data is available.</p> : <p className="text-sm text-muted-foreground">Keep this page open while creation runs. Each completed step is saved; reopening the build resumes from the last checkpoint.</p>}
    {error && <Alert variant="destructive"><AlertDescription>{error} Your completed steps are saved.</AlertDescription></Alert>}
    {status.blockers.length > 0 && <Alert><AlertDescription><ul className="list-disc space-y-1 pl-4">{status.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></AlertDescription></Alert>}
    <Link className="inline-block text-sm underline" href={`/instruments/${buildId}/ai-review`}>Inspect AI reviews and scoring keys</Link>
    {!status.ready && <Button variant="outline" onClick={() => { if (!running) { resume.current = true; setError(null) } setRunning(value => !value) }}>{running ? 'Pause after current step' : 'Resume automatic creation'}</Button>}
  </Card>
}
