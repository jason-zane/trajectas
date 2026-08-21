'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Wand2, AlertTriangle, ArrowRight } from 'lucide-react'

import {
  ActionDialog,
  ActionWizard,
  type ActionWizardStep,
} from '@/components/action-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  createInstrumentBuild,
  proposeStructureAction,
  deleteInstrumentBuild,
  confirmStructureAction,
  matchModelAgainstLibraryAction,
  assessBuildSoundnessAction,
  quickBuildInstrumentAction,
} from '@/app/actions/instrument'
import { ModelInput } from '@/components/instruments/model-input'
import { SoundnessPanel } from '@/components/instruments/soundness-panel'
import type { SoundnessReport } from '@/lib/instrument/soundness'
import {
  LibraryMatchList,
  type MatchDecision,
} from '@/components/instruments/library-match-list'
import type { ConstructMatchResult } from '@/lib/instrument/library-match'
import type { MeasureType } from '@/lib/instrument/types'

const MEASURE_TYPE_OPTIONS: Array<{ value: MeasureType; label: string; description: string }> = [
  {
    value: 'trait',
    label: 'Trait',
    description: 'Stable, dispositional characteristics (e.g., openness, conscientiousness)',
  },
  {
    value: 'competency_behavioural',
    label: 'Competency (Behavioural)',
    description: 'Observable, context-dependent behaviors and capabilities',
  },
  {
    value: 'capability',
    label: 'Capability',
    description: 'Integrated combinations of skills, knowledge, and attributes',
  },
  {
    value: 'sjt',
    label: 'Situational Judgment Test',
    description: 'Judgment and decision-making in workplace scenarios',
  },
  {
    value: 'forced_choice',
    label: 'Forced Choice',
    description: 'Paired comparison items for preference and motivation assessment',
  },
  {
    value: 'preference',
    label: 'Preference',
    description: 'Motivations, interests, and work environment preferences',
  },
  {
    value: 'climate',
    label: 'Climate',
    description: 'Organizational or team culture and psychological safety perceptions',
  },
  {
    value: 'validity_scale',
    label: 'Validity Scale',
    description: 'Response style detection and impression management',
  },
]

const AUDIENCE_OPTIONS = [
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'open', label: 'Open' },
]

type StepId = 'brief' | 'constructs' | 'scope' | 'generate'

const WIZARD_STEPS: ActionWizardStep[] = [
  { id: 'brief', label: 'Brief' },
  { id: 'constructs', label: 'Constructs' },
  { id: 'scope', label: 'Scope' },
  { id: 'generate', label: 'Generate' },
]

type ProposedConstruct = {
  name: string
  definition: string
  exclusions: string[]
  included: boolean
}

type PreflightPair = {
  constructAIndex: number
  constructBIndex: number
  constructAName: string
  constructBName: string
  cosineSimilarity: number
  status: 'green' | 'amber' | 'red'
  reviewedByLlm: boolean
  overlapSummary?: string
  sharedSignals?: string[]
  uniqueSignalsA?: string[]
  uniqueSignalsB?: string[]
  discriminatingItemsA?: string[]
  discriminatingItemsB?: string[]
  refinementGuidanceA?: string
  refinementGuidanceB?: string
  llmExplanation?: string
}

interface QuickBuildModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickBuildModal({ open, onOpenChange }: QuickBuildModalProps) {
  const router = useRouter()
  const [stepId, setStepId] = useState<StepId>('brief')
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left')
  const [busy, setBusy] = useState(false)

  // Step 1: Brief
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [measureType, setMeasureType] = useState<MeasureType | ''>('')
  const [audience, setAudience] = useState<string>('')
  const [buildId, setBuildId] = useState<string | null>(null)

  // Step 2: Constructs
  const [proposedConstructs, setProposedConstructs] = useState<ProposedConstruct[]>([])
  const [preflightPairs, setPreflightPairs] = useState<PreflightPair[]>([])
  const [proposing, setProposing] = useState(false)
  const [renamedConstructs, setRenamedConstructs] = useState<ProposedConstruct[]>([])

  // Bring-your-own model. When the author pastes a set, it becomes the starting
  // point and the AI proposal is skipped entirely — asking a model to invent
  // constructs for someone who already has them is the wrong default.
  const [modelText, setModelText] = useState('')
  const [pastedConstructs, setPastedConstructs] = useState<ProposedConstruct[]>([])
  const [matchResults, setMatchResults] = useState<ConstructMatchResult[]>([])
  const [matchDecisions, setMatchDecisions] = useState<Record<number, MatchDecision>>({})
  const [matching, setMatching] = useState(false)
  const [soundness, setSoundness] = useState<SoundnessReport | null>(null)
  const [assessing, setAssessing] = useState(false)

  // Step 3: Scope
  const [itemsPerConstruct, setItemsPerConstruct] = useState(10)
  const [targetAlpha, setTargetAlpha] = useState(0.8)
  const [readingLevel, setReadingLevel] = useState('mixed')

  // Step 4: Generate
  const [generationProgress, setGenerationProgress] = useState<{
    total: number
    completed: number
    current: string
  } | null>(null)
  const [generationErrors, setGenerationErrors] = useState<Array<{ stage: string; error: string }>>([])

  const selectedMeasureType = MEASURE_TYPE_OPTIONS.find((opt) => opt.value === measureType)
  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === stepId)
  const includedConstructs = renamedConstructs.length > 0 ? renamedConstructs.filter((c) => c.included) : proposedConstructs.filter((c) => c.included)

  function reset() {
    setStepId('brief')
    setBusy(false)
    setName('')
    setBrief('')
    setMeasureType('')
    setAudience('')
    setBuildId(null)
    setProposedConstructs([])
    setPreflightPairs([])
    setProposing(false)
    setRenamedConstructs([])
    setItemsPerConstruct(10)
    setTargetAlpha(0.8)
    setReadingLevel('mixed')
    setGenerationProgress(null)
    setGenerationErrors([])
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // The build row is created when leaving the Brief step, before the user
      // has confirmed anything. Abandoning the wizard after that point used to
      // leave a permanent empty instrument in the list. Discard it — unless
      // generation has started, in which case the build holds real work.
      const abandoned = buildId
      const startedGenerating = generationProgress !== null
      if (abandoned && !startedGenerating) {
        void deleteInstrumentBuild(abandoned).catch(() => {
          // Non-fatal: an orphan build is untidy, not harmful, and the user has
          // already closed the dialog. Never surface an error for this.
        })
      }
      reset()
      router.refresh()
    }
    onOpenChange(next)
  }

  function canAdvance(): boolean {
    if (busy || proposing) return false
    if (stepId === 'brief') return name.trim().length > 0 && measureType !== ''
    if (stepId === 'constructs') return includedConstructs.length > 0
    if (stepId === 'scope') return true
    if (stepId === 'generate') return false // generate button will be clicked separately
    return false
  }

  function goTo(next: StepId, direction: 'left' | 'right' = 'left') {
    setSlideDirection(direction)
    setStepId(next)
  }

  /** Check a construct set against the library so duplicates surface before build. */
  async function runLibraryMatch(constructs: ProposedConstruct[]) {
    const named = constructs.filter((c) => c.included && c.name.trim().length > 0)
    if (named.length === 0) {
      setMatchResults([])
      return
    }
    setMatching(true)
    try {
      setMatchResults(await matchModelAgainstLibraryAction(named))
    } catch {
      // Never block the build on this — publish remains a second line of defence.
      setMatchResults([])
    } finally {
      setMatching(false)
    }
  }

  /** Check the model before spending anything generating items against it. */
  async function handleAssessSoundness() {
    if (!buildId) return
    setAssessing(true)
    try {
      setSoundness(
        await assessBuildSoundnessAction(
          buildId,
          displayConstructs.filter((c) => c.included && c.name.trim().length > 0)
        )
      )
    } catch (err) {
      toast.error('Could not check the model', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setAssessing(false)
    }
  }

  /** Fill in what the pasted model is missing, keeping every supplied construct. */
  async function handleFillGaps() {
    if (!buildId) return
    setProposing(true)
    try {
      const result = await proposeStructureAction(
        buildId,
        displayConstructs.filter((c) => c.included && c.name.trim().length > 0)
      )
      const constructs = result.constructs.map((c) => ({
        name: c.name,
        definition: c.definition,
        exclusions: c.exclusions,
        included: true,
      }))
      setProposedConstructs(constructs)
      setRenamedConstructs([])
      setPreflightPairs(result.preflightPairs)
      toast.success(`Model now has ${constructs.length} constructs`)
      await runLibraryMatch(constructs)
    } catch (err) {
      toast.error('Could not fill gaps', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setProposing(false)
    }
  }

  async function handleNext() {
    if (!canAdvance()) return

    if (stepId === 'brief') {
      goTo('constructs')
      setBusy(true)
      try {
        const result = await createInstrumentBuild({
          name: name.trim(),
          measureType,
          brief: brief.trim() || undefined,
          audience: audience ? { level: audience } : undefined,
          targetConstructCount: null,
          targetItemsPerConstruct: null,
        })
        setBuildId(result.id)

        setProposing(true)

        let constructs: ProposedConstruct[]

        if (pastedConstructs.length > 0) {
          // The author brought their own. Take it as given.
          constructs = pastedConstructs
          setProposedConstructs(constructs)
          setPreflightPairs([])
        } else {
          const proposal = await proposeStructureAction(result.id)
          constructs = proposal.constructs.map((c) => ({
            name: c.name,
            definition: c.definition,
            exclusions: c.exclusions,
            included: true,
          }))
          setProposedConstructs(constructs)
          setPreflightPairs(proposal.preflightPairs)
        }

        setRenamedConstructs([])
        await runLibraryMatch(constructs)
      } catch (err) {
        toast.error('Failed to create build', {
          description: err instanceof Error ? err.message : 'Please try again.',
        })
        goTo('brief', 'right')
      } finally {
        setBusy(false)
        setProposing(false)
      }
      return
    }

    if (stepId === 'constructs') {
      if (!buildId) throw new Error('Build ID missing')
      goTo('scope')
      setBusy(true)
      try {
        // Use renamed constructs if available, otherwise use proposed
        const toConfirm = renamedConstructs.length > 0 ? renamedConstructs : proposedConstructs

        // Honour the reuse choices, so a construct the author recognised as one
        // they already own links to it instead of being minted a second time.
        const libraryLinks: Record<string, string> = {}
        for (const [indexKey, decision] of Object.entries(matchDecisions)) {
          if (decision.decision !== 'reuse') continue
          const construct = displayConstructs[Number(indexKey)]
          if (construct?.included && construct.name.trim()) {
            libraryLinks[construct.name.trim()] = decision.libraryConstructId
          }
        }

        // Pass the overlap pairs through so they are persisted as evidence and
        // reach the technical report's discriminant section.
        await confirmStructureAction(
          buildId,
          toConfirm.filter((c) => c.included),
          preflightPairs.map((p) => ({
            constructAName: p.constructAName,
            constructBName: p.constructBName,
            cosineSimilarity: p.cosineSimilarity,
          })),
          libraryLinks
        )
      } catch (err) {
        toast.error('Failed to confirm constructs', {
          description: err instanceof Error ? err.message : 'Please try again.',
        })
        goTo('constructs', 'right')
      } finally {
        setBusy(false)
      }
      return
    }

    if (stepId === 'scope') {
      goTo('generate')
      return
    }
  }

  async function handleGenerate() {
    if (!buildId) {
      toast.error('Build not found')
      return
    }

    setBusy(true)
    setGenerationProgress({ total: includedConstructs.length, completed: 0, current: 'Starting...' })
    setGenerationErrors([])

    try {
      const result = await quickBuildInstrumentAction(buildId, {
        constructs: includedConstructs.filter((c) => c.included),
        itemsPerConstruct,
        targetAlpha,
        readingLevel,
      })

      if (result.error) {
        toast.error('Generation incomplete', {
          description: result.error,
        })
      } else {
        toast.success('Instrument ready', {
          description: `${includedConstructs.length} constructs with ${result.totalItems} items`,
        })
      }

      handleOpenChange(false)
      router.push(`/instruments/${buildId}/report`)
    } catch (err) {
      toast.error('Generation failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setBusy(false)
      setGenerationProgress(null)
    }
  }

  function handleBack() {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === stepId)
    const prev = WIZARD_STEPS[idx - 1]
    if (prev) goTo(prev.id as StepId, 'right')
  }

  function toggleConstruct(index: number) {
    if (renamedConstructs.length > 0) {
      setRenamedConstructs((prev) =>
        prev.map((c, i) => (i === index ? { ...c, included: !c.included } : c))
      )
    } else {
      setProposedConstructs((prev) =>
        prev.map((c, i) => (i === index ? { ...c, included: !c.included } : c))
      )
    }
  }

  function updateConstructName(index: number, newName: string) {
    if (renamedConstructs.length === 0) {
      setRenamedConstructs([...proposedConstructs])
    }
    setRenamedConstructs((prev) =>
      prev.map((c, i) => (i === index ? { ...c, name: newName } : c))
    )
  }

  function updateConstructDefinition(index: number, newDef: string) {
    if (renamedConstructs.length === 0) {
      setRenamedConstructs([...proposedConstructs])
    }
    setRenamedConstructs((prev) =>
      prev.map((c, i) => (i === index ? { ...c, definition: newDef } : c))
    )
  }

  const displayConstructs = renamedConstructs.length > 0 ? renamedConstructs : proposedConstructs

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      eyebrow='Instruments'
      title='Build an Instrument'
      description='Define what you measure, choose constructs, set scope, and generate items in four simple steps.'
      size='xl'
    >
      <ActionWizard
        steps={WIZARD_STEPS}
        currentStepIndex={currentStepIndex}
        onBack={handleBack}
        onNext={handleNext}
        onComplete={handleGenerate}
        onCancel={() => handleOpenChange(false)}
        canAdvance={canAdvance()}
        isSubmitting={busy}
        completeLabel='Generate Items'
        completeIcon={<Wand2 className='size-4' />}
        submittingLabel={generationProgress ? `${generationProgress.completed}/${generationProgress.total}…` : 'Generating…'}
        slideDirection={slideDirection}
      >
        {/* Step 1: Brief */}
        {stepId === 'brief' && (
          <div className='space-y-5'>
            <div className='space-y-2'>
              <Label htmlFor='qb-name'>Instrument Name</Label>
              <Input
                id='qb-name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g., Leadership Capacity Index'
                autoFocus
                disabled={busy}
              />
              <p className='text-xs text-muted-foreground'>
                A clear name that identifies this instrument uniquely.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='qb-measure'>Measure Type</Label>
              <Select
                value={measureType}
                onValueChange={(val) => setMeasureType(val as MeasureType)}
                disabled={busy}
              >
                <SelectTrigger id='qb-measure'>
                  <SelectValue placeholder='Select a measure type' />
                </SelectTrigger>
                <SelectContent>
                  {MEASURE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMeasureType && (
                <p className='text-xs text-muted-foreground'>{selectedMeasureType.description}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='qb-brief'>What is this measuring?</Label>
              <Textarea
                id='qb-brief'
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder='Describe the competency or trait, who it applies to, and what decision it informs...'
                rows={4}
                disabled={busy}
              />
              <p className='text-xs text-muted-foreground'>
                Optional. Used in design notes and structure proposal.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='qb-audience'>Audience (optional)</Label>
              <Select
                value={audience}
                onValueChange={(val) => setAudience(val ?? '')}
                disabled={busy}
              >
                <SelectTrigger id='qb-audience'>
                  <SelectValue placeholder='Select audience level' />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Already have a model? Skip the proposal entirely. */}
            <div className='space-y-2 border-t border-border pt-4'>
              <Label htmlFor='qb-model'>Already have your constructs? (optional)</Label>
              <ModelInput
                value={modelText}
                onChange={setModelText}
                onAccept={(constructs) => {
                  setPastedConstructs(
                    constructs.map((c) => ({
                      name: c.name,
                      definition: c.definition,
                      exclusions: c.exclusions,
                      included: true,
                    }))
                  )
                  toast.success(`${constructs.length} constructs ready`)
                }}
                disabled={busy}
              />
              {pastedConstructs.length > 0 && (
                <Alert variant='success'>
                  <AlertDescription>
                    Using your {pastedConstructs.length} constructs. The AI proposal
                    will be skipped — you can fill any gaps on the next step.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Constructs */}
        {stepId === 'constructs' && (
          <div className='space-y-4'>
            {proposing ? (
              <ConstructsSkeleton />
            ) : proposedConstructs.length === 0 ? (
              <div className='rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground'>
                No constructs proposed. Go back and add more detail.
              </div>
            ) : (
              <>
                <div className='flex items-start justify-between gap-4'>
                  <p className='text-sm text-muted-foreground'>
                    Review the constructs below. Edit names or definitions, toggle to include/exclude, and confirm to proceed.
                  </p>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleFillGaps}
                    disabled={busy || proposing}
                    className='shrink-0'
                  >
                    Fill gaps with AI
                  </Button>
                </div>

                {preflightPairs.length > 0 && (
                  <Alert variant='warning'>
                    <AlertTriangle className='size-4' />
                    <AlertDescription>
                      <div className='space-y-1'>
                        <p className='font-medium'>Discriminability review</p>
                        <ul className='space-y-0.5 text-xs'>
                          {preflightPairs.map((pair, i) => (
                            <li key={i}>
                              {pair.constructAName} ↔ {pair.constructBName}{' '}
                              <span className='tabular-nums'>
                                ({(pair.cosineSimilarity * 100).toFixed(1)}%)
                              </span>{' '}
                              — {pair.status}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <SoundnessPanel
                  report={soundness}
                  isRunning={assessing}
                  onRun={handleAssessSoundness}
                />

                <LibraryMatchList
                  results={matchResults}
                  decisions={matchDecisions}
                  onDecide={(decision) =>
                    setMatchDecisions((prev) => ({
                      ...prev,
                      [decision.constructIndex]: decision,
                    }))
                  }
                  proposedDefinitions={Object.fromEntries(
                    displayConstructs.map((c, i) => [i, c.definition])
                  )}
                  isLoading={matching}
                />

                <div className='space-y-2'>
                  {displayConstructs.map((construct, idx) => (
                    <Card
                      key={idx}
                      className={cn(
                        'p-4 transition-colors',
                        construct.included ? 'border-primary/40 bg-primary/[0.03]' : 'border-border opacity-70'
                      )}
                    >
                      <div className='space-y-3'>
                        <Input
                          value={construct.name}
                          onChange={(e) => updateConstructName(idx, e.target.value)}
                          placeholder='Construct name'
                          className='font-medium'
                          disabled={busy}
                        />
                        <Textarea
                          value={construct.definition}
                          onChange={(e) => updateConstructDefinition(idx, e.target.value)}
                          placeholder='Definition'
                          rows={2}
                          className='text-xs'
                          disabled={busy}
                        />
                        <div className='flex items-center gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => toggleConstruct(idx)}
                            disabled={busy}
                          >
                            {construct.included ? '✓ Include' : 'Exclude'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Scope */}
        {stepId === 'scope' && (
          <div className='space-y-6'>
            <div className='space-y-3 rounded-lg border border-border bg-muted/20 p-4'>
              <div className='flex items-center justify-between'>
                <Label className='text-sm font-medium'>Items per construct</Label>
                <Badge variant='secondary'>{itemsPerConstruct}</Badge>
              </div>
              <Slider
                value={[itemsPerConstruct]}
                min={3}
                max={50}
                step={1}
                onValueChange={(v) => setItemsPerConstruct(Array.isArray(v) ? (v[0] ?? 10) : v)}
                disabled={busy}
              />
              <p className='text-xs text-muted-foreground'>
                Average items per construct across facets and intensities. Starts with a balanced grid based on your choices.
              </p>
            </div>

            <div className='space-y-3 rounded-lg border border-border bg-muted/20 p-4'>
              <div className='flex items-center justify-between'>
                <Label className='text-sm font-medium'>Target internal consistency (α)</Label>
                <Badge variant='secondary'>{targetAlpha.toFixed(2)}</Badge>
              </div>
              <Slider
                value={[targetAlpha]}
                min={0.6}
                max={0.95}
                step={0.05}
                onValueChange={(v) => setTargetAlpha(Array.isArray(v) ? (v[0] ?? 0.8) : v)}
                disabled={busy}
              />
              <p className='text-xs text-muted-foreground'>
                Reliability estimate used to size items and compute the blueprint. Higher values increase homogeneity.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='qb-reading'>Reading level / Audience</Label>
              <Select
                value={readingLevel}
                onValueChange={(val) => setReadingLevel(val ?? 'mixed')}
                disabled={busy}
              >
                <SelectTrigger id='qb-reading'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='entry'>Entry level</SelectItem>
                  <SelectItem value='mid'>Mid-level</SelectItem>
                  <SelectItem value='senior'>Senior</SelectItem>
                  <SelectItem value='mixed'>Mixed</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Used by fairness screen to flag overly complex items.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Generate */}
        {stepId === 'generate' && (
          <div className='space-y-6'>
            <div className='rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm'>
              <div className='flex items-center gap-2 text-muted-foreground'>
                <Sparkles className='size-4 text-primary' />
                {includedConstructs.length} constructs · ~{itemsPerConstruct * includedConstructs.length} items
              </div>
            </div>

            {generationProgress && (
              <div className='space-y-3'>
                <div className='space-y-1'>
                  <p className='text-sm font-medium'>{generationProgress.current}</p>
                  <div className='h-2 w-full rounded-full bg-muted'>
                    <div
                      className='h-full rounded-full bg-primary transition-all duration-300'
                      style={{
                        width: `${(generationProgress.completed / generationProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {generationProgress.completed} of {generationProgress.total}
                  </p>
                </div>
              </div>
            )}

            {generationErrors.length > 0 && (
              <div className='space-y-2'>
                <p className='text-sm font-medium text-foreground'>Warnings</p>
                <div className='space-y-1'>
                  {generationErrors.map((err, i) => (
                    <div
                      key={i}
                      className='rounded px-3 py-2 text-xs bg-amber-500/10 text-amber-800'
                    >
                      <span className='font-medium'>{err.stage}:</span> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!generationProgress && generationErrors.length === 0 && (
              <div className='space-y-3'>
                <p className='text-sm text-muted-foreground'>
                  Ready to generate items for all {includedConstructs.length} constructs.
                </p>
                <div className='space-y-2 text-sm'>
                  <div className='flex items-center gap-2 text-foreground/80'>
                    <ArrowRight className='size-4' />
                    Blueprint draft per construct
                  </div>
                  <div className='flex items-center gap-2 text-foreground/80'>
                    <ArrowRight className='size-4' />
                    Item generation with deduplication
                  </div>
                  <div className='flex items-center gap-2 text-foreground/80'>
                    <ArrowRight className='size-4' />
                    Critique pass for consistency
                  </div>
                  <div className='flex items-center gap-2 text-foreground/80'>
                    <ArrowRight className='size-4' />
                    Congruence panel for alignment
                  </div>
                  <div className='flex items-center gap-2 text-foreground/80'>
                    <ArrowRight className='size-4' />
                    Fairness screen for accessibility
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ActionWizard>
    </ActionDialog>
  )
}

function ConstructsSkeleton() {
  return (
    <div className='space-y-2'>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className='space-y-2 rounded-lg border border-border bg-muted/20 p-4'>
          <Skeleton className='h-4 w-1/3' />
          <Skeleton className='h-12 w-full' />
        </div>
      ))}
    </div>
  )
}
