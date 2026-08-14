'use client'

/**
 * run-calibration-panel.tsx — Empirical loop controller.
 *
 * Provides the UI for running a full calibration analysis on all constructs.
 * Includes scope controls: campaign multi-select, internal/test data toggle,
 * optional date window, and run label. Displays a live preview of session count.
 *
 * Displays results with sample-size honesty: when n < 100, results are labeled
 * as provisional (real observations on too small a sample), not green-ticketed.
 *
 * No server-side imports; all data passed as props. Calls runCalibration action
 * with scope parameters, toast feedback and pending state.
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Activity, AlertTriangle, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  getCalibrationScopePreview,
  runCalibration,
} from '@/app/actions/psychometrics'

/** Below this many complete cases, CTT estimates are noise rather than measurement. */
const MIN_STABLE_SAMPLE = 100

interface ScopePreviewData {
  eligibleSessions: number
  campaigns: Array<{
    id: string
    title: string
    isInternal: boolean
    completedSessions: number
  }>
}

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
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)

  // Scope state
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([])
  const [includeInternal, setIncludeInternal] = useState(false)
  const [sinceDate, setSinceDate] = useState('')
  const [untilDate, setUntilDate] = useState('')
  const [runLabel, setRunLabel] = useState('')

  // Preview state
  const [preview, setPreview] = useState<ScopePreviewData | null>(null)

  // Load preview on scope change
  useEffect(() => {
    if (!scopeOpen) return

    const loadPreview = async () => {
      setIsLoadingPreview(true)
      try {
        const result = await getCalibrationScopePreview({
          campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
          includeInternal,
          since: sinceDate || undefined,
          until: untilDate || undefined,
        })
        setPreview(result)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load scope preview'
        )
      } finally {
        setIsLoadingPreview(false)
      }
    }

    loadPreview()
    // The window must be part of the preview, or the count shown is not the
    // sample the run would actually draw.
  }, [selectedCampaignIds, includeInternal, sinceDate, untilDate, scopeOpen])

  function handleRunCalibration() {
    startTransition(async () => {
      try {
        const result = await runCalibration({
          campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
          includeInternal,
          since: sinceDate || undefined,
          until: untilDate || undefined,
          label: runLabel || undefined,
        })

        if (result.warnings.length > 0) {
          toast.warning('Calibration completed with notes', {
            description: `${result.sampleSize} responses analyzed. ${result.warnings.length} note(s).`,
          })
        } else {
          toast.success('Calibration completed', {
            description: `${result.sampleSize} responses analyzed.`,
          })
        }

        // Reset form
        setScopeOpen(false)
        setSelectedCampaignIds([])
        setIncludeInternal(false)
        setSinceDate('')
        setUntilDate('')
        setRunLabel('')

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

  const gateN = lastCalibrationMinConstructN ?? lastCalibrationSampleSize

  // Calculate effective session count from preview
  const effectiveSessionCount = preview?.eligibleSessions ?? 0

  return (
    <div className='space-y-6'>
      <Card className='border-dashed p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h3 className='text-sm font-semibold'>Run calibration</h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              Analyze item quality and construct reliability from completed participant responses.
            </p>
          </div>
          <Button
            onClick={() => setScopeOpen(!scopeOpen)}
            disabled={isPending}
            size='sm'
            variant={scopeOpen ? 'default' : 'outline'}
            className='gap-2'
          >
            {scopeOpen ? 'Collapse options' : 'Configure & run'}
            <ChevronDown className={`h-4 w-4 transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Scope controls */}
        {scopeOpen && (
          <div className='mt-6 space-y-6 border-t pt-6'>
            {/* Campaign selection */}
            {preview?.campaigns && preview.campaigns.length > 0 && (
              <div className='space-y-3'>
                <Label className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
                  Campaigns
                </Label>
                <div className='space-y-2 max-h-64 overflow-y-auto'>
                  {preview.campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className='flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3'
                    >
                      <Checkbox
                        id={`campaign-${campaign.id}`}
                        checked={selectedCampaignIds.includes(campaign.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCampaignIds([...selectedCampaignIds, campaign.id])
                          } else {
                            setSelectedCampaignIds(
                              selectedCampaignIds.filter((id) => id !== campaign.id)
                            )
                          }
                        }}
                        disabled={isPending}
                      />
                      <label
                        htmlFor={`campaign-${campaign.id}`}
                        className='flex-1 cursor-pointer text-sm font-medium'
                      >
                        {campaign.title}
                        {campaign.completedSessions > 0 && (
                          <span className='text-xs text-muted-foreground ml-2'>
                            ({campaign.completedSessions} sessions)
                          </span>
                        )}
                      </label>
                      {campaign.isInternal && (
                        <Badge variant='secondary' className='text-xs'>
                          Internal
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal/test data toggle */}
            <div className='space-y-3'>
              <div className='flex items-center gap-3'>
                <Checkbox
                  id='include-internal'
                  checked={includeInternal}
                  onCheckedChange={(checked) =>
                    setIncludeInternal(checked === true)
                  }
                  disabled={isPending}
                />
                <label htmlFor='include-internal' className='cursor-pointer'>
                  <p className='text-sm font-medium'>Include internal/test data</p>
                  <p className='text-xs text-muted-foreground'>
                    Normally excluded so statistics reflect real respondents
                  </p>
                </label>
              </div>
            </div>

            {/* Optional date window */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='since' className='text-xs font-medium'>
                  Since (optional)
                </Label>
                <Input
                  id='since'
                  type='date'
                  value={sinceDate}
                  onChange={(e) => setSinceDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='until' className='text-xs font-medium'>
                  Until (optional)
                </Label>
                <Input
                  id='until'
                  type='date'
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Run label */}
            <div className='space-y-2'>
              <Label htmlFor='label' className='text-xs font-medium'>
                Run label (optional)
              </Label>
              <Input
                id='label'
                placeholder='e.g., Q4 2024 Recalibration'
                value={runLabel}
                onChange={(e) => setRunLabel(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Preview readout */}
            {isLoadingPreview ? (
              <div className='rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground'>
                Loading preview…
              </div>
            ) : preview ? (
              <div className='space-y-2 rounded-lg border border-border bg-muted/40 p-4'>
                <div className='text-xs font-medium text-muted-foreground'>
                  Scope preview
                </div>
                {effectiveSessionCount > 0 ? (
                  <div className='flex items-baseline gap-2'>
                    <span className='text-2xl font-bold tabular-nums'>
                      {effectiveSessionCount}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      eligible session{effectiveSessionCount === 1 ? '' : 's'} will be included in this run
                    </span>
                  </div>
                ) : (
                  <div className='text-sm text-muted-foreground'>
                    No eligible sessions match these criteria. Internal data is excluded
                    by default — check &ldquo;Include internal/test data&rdquo; if you need it.
                  </div>
                )}
              </div>
            ) : null}

            {/* Run button */}
            <div className='flex gap-3 pt-2'>
              <Button
                onClick={handleRunCalibration}
                disabled={isPending || (preview ? effectiveSessionCount === 0 : false)}
                className='flex-1'
              >
                {isPending ? 'Running…' : 'Run calibration'}
              </Button>
              <Button
                variant='outline'
                onClick={() => setScopeOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Provisional sample size warning */}
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

        {/* Last calibration info */}
        {formattedDate && !scopeOpen && (
          <div className='mt-4 flex items-center gap-2 text-xs text-muted-foreground'>
            <Activity className='h-4 w-4' />
            <span>Last calibration: {formattedDate}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
