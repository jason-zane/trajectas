'use client'

/**
 * run-calibration-panel.tsx — Empirical loop controller.
 *
 * Provides the UI for running a full calibration analysis on all constructs.
 * Displays results with sample-size honesty: when n < 100, results are labeled
 * as provisional (real observations on too small a sample), not green-ticketed.
 *
 * No server-side imports; all data passed as props. Calls runCalibration action
 * with toast feedback and pending state.
 */

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Activity, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { runCalibration } from '@/app/actions/psychometrics'

/** Below this many complete cases, CTT estimates are noise rather than measurement. */
const MIN_STABLE_SAMPLE = 100

interface RunCalibrationPanelProps {
  lastCalibrationDate: string | null
  lastCalibrationSampleSize: number | null
  lastCalibrationMinConstructN: number | null
}

export function RunCalibrationPanel({
  lastCalibrationDate,
  lastCalibrationSampleSize,
  lastCalibrationMinConstructN,
}: RunCalibrationPanelProps) {
  const [isPending, startTransition] = useTransition()

  // Prefer the per-construct floor; fall back to the run total when absent.
  const gateN = lastCalibrationMinConstructN ?? lastCalibrationSampleSize

  function handleRunCalibration() {
    startTransition(async () => {
      try {
        const result = await runCalibration()

        if (result.warnings.length > 0) {
          toast.warning('Calibration completed with notes', {
            description: `${result.sampleSize} responses analyzed. ${result.warnings.length} note(s).`,
          })
        } else {
          toast.success('Calibration completed', {
            description: `${result.sampleSize} responses analyzed.`,
          })
        }

        // Trigger a page refresh to fetch updated results
        setTimeout(() => window.location.reload(), 1500)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        toast.error('Calibration failed', {
          description: msg,
        })
      }
    })
  }

  const formattedDate = lastCalibrationDate
    ? new Date(lastCalibrationDate).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className='space-y-6'>
      {/* Control card */}
      <Card className='border-dashed p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h3 className='text-sm font-semibold'>Run calibration</h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              Analyze item quality and construct reliability from completed participant responses.
            </p>
          </div>
          <Button
            onClick={handleRunCalibration}
            disabled={isPending}
            size='sm'
            variant='outline'
          >
            {isPending ? 'Running…' : 'Run calibration'}
          </Button>
        </div>

        {/* Gate on the SMALLEST per-construct n, not the run-wide session
            count: each alpha is governed by its own construct's sample, so the
            run total would understate how thin the data is. Persistent rather
            than component state — the previous version lost the caveat to the
            revalidate its own success triggered. */}
        {gateN !== null && gateN < MIN_STABLE_SAMPLE && (
          <Alert className='mt-4 border-amber-500/40 bg-amber-500/5'>
            <AlertTriangle className='h-4 w-4 text-amber-600 dark:text-amber-400' />
            <AlertDescription className='text-xs leading-relaxed'>
              <span className='font-medium text-amber-700 dark:text-amber-400'>
                Provisional — as few as {gateN} complete{' '}
                {gateN === 1 ? 'case' : 'cases'} on some scales
              </span>
              <span className='text-muted-foreground mt-1 block'>
                These are real observations, but stable CTT estimates need roughly{' '}
                {MIN_STABLE_SAMPLE}+ respondents per scale. At this sample size alpha can come out
                negative purely by chance. Treat them as a working signal, not a measurement.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {formattedDate && (
          <div className='mt-4 flex items-center gap-2 text-xs text-muted-foreground'>
            <Activity className='h-4 w-4' />
            <span>Last calibration: {formattedDate}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
