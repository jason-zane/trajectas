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
import { Activity } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { runCalibration } from '@/app/actions/psychometrics'

/** Below this many complete cases, CTT estimates are noise rather than measurement. */
const MIN_STABLE_SAMPLE = 100

interface RunCalibrationPanelProps {
  lastCalibrationDate: string | null
  lastCalibrationSampleSize: number | null
}

export function RunCalibrationPanel({
  lastCalibrationDate,
  lastCalibrationSampleSize,
}: RunCalibrationPanelProps) {
  const [isPending, startTransition] = useTransition()

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

        {/* Persistent, derived from the stored run rather than in-memory state:
            the previous version lost its result to the revalidate its own
            success triggered, so the sample-size caveat vanished on reload. */}
        {lastCalibrationSampleSize !== null &&
          lastCalibrationSampleSize < MIN_STABLE_SAMPLE && (
            <div className='mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3'>
              <p className='text-xs font-medium text-amber-700 dark:text-amber-400'>
                Provisional — {lastCalibrationSampleSize} complete{' '}
                {lastCalibrationSampleSize === 1 ? 'case' : 'cases'}
              </p>
              <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                These are real observations, but stable CTT estimates need roughly{' '}
                {MIN_STABLE_SAMPLE}+ respondents per scale. At this sample size alpha can come out
                negative purely by chance. Treat them as a working signal, not a measurement.
              </p>
            </div>
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
