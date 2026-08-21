'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import type { InstrumentBuildDto } from '@/lib/dal/instrument-mappers'
import {
  proposeStructureAction,
  confirmStructureAction,
  matchModelAgainstLibraryAction,
  assessBuildSoundnessAction,
} from '@/app/actions/instrument'
import { ModelInput } from '@/components/instruments/model-input'
import {
  LibraryMatchList,
  type MatchDecision,
} from '@/components/instruments/library-match-list'
import { SoundnessPanel } from '@/components/instruments/soundness-panel'
import type { ConstructMatchResult } from '@/lib/instrument/library-match'
import type { SoundnessReport } from '@/lib/instrument/soundness'

interface ProposedConstruct {
  name: string
  definition: string
  exclusions: string[]
}

interface PreflightPair {
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

interface StructureEditorProps {
  build: InstrumentBuildDto
}

export function StructureEditor({ build }: StructureEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [constructs, setConstructs] = useState<ProposedConstruct[]>([])
  const [preflightPairs, setPreflightPairs] = useState<PreflightPair[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [isProposing, setIsProposing] = useState(false)
  const [modelText, setModelText] = useState('')
  const [matchResults, setMatchResults] = useState<ConstructMatchResult[]>([])
  const [matchDecisions, setMatchDecisions] = useState<Record<number, MatchDecision>>({})
  const [isMatching, setIsMatching] = useState(false)
  const [soundness, setSoundness] = useState<SoundnessReport | null>(null)
  const [isAssessing, setIsAssessing] = useState(false)

  /**
   * Check a construct set against the library.
   *
   * Fired whenever the set changes wholesale rather than on every keystroke —
   * each run costs an embedding call, and a half-typed construct name is not
   * worth matching.
   */
  const runLibraryMatch = async (next: ProposedConstruct[]) => {
    const named = next.filter((c) => c.name.trim().length > 0)
    if (named.length === 0) {
      setMatchResults([])
      return
    }
    setIsMatching(true)
    try {
      setMatchResults(await matchModelAgainstLibraryAction(named))
    } catch (error) {
      // A library outage must not block authoring — the author can still proceed,
      // and the publish step remains a second line of defence against duplicates.
      toast.error(
        error instanceof Error ? error.message : 'Could not check the construct library'
      )
      setMatchResults([])
    } finally {
      setIsMatching(false)
    }
  }

  /**
   * Propose constructs. Passing the current set turns this into gap-fill: what is
   * already on screen is treated as fixed and the model returns only additions.
   * Passing nothing is the original behaviour — propose the set from scratch.
   */
  const handleProposeStructure = (mode: 'fresh' | 'fill-gaps' = 'fresh') => {
    setIsProposing(true)
    startTransition(async () => {
      try {
        const known =
          mode === 'fill-gaps'
            ? constructs.filter((c) => c.name.trim().length > 0)
            : undefined

        const result = await proposeStructureAction(build.id, known)
        setConstructs(result.constructs)
        setPreflightPairs(result.preflightPairs)
        setWarnings(result.warnings)

        const added = result.constructs.length - (known?.length ?? 0)
        if (result.warnings.length > 0) {
          toast.info(`Generated with ${result.warnings.length} warning(s)`)
        } else if (mode === 'fill-gaps') {
          toast.success(added > 0 ? `Added ${added} construct${added === 1 ? "" : "s"}` : 'No gaps found')
        } else {
          toast.success(`Generated ${result.constructs.length} constructs`)
        }

        await runLibraryMatch(result.constructs)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to propose constructs'
        )
        if (mode === 'fresh') {
          setConstructs([])
          setPreflightPairs([])
        }
      } finally {
        setIsProposing(false)
      }
    })
  }

  /** Adopt a model the author pasted, rather than one the AI wrote. */
  const handleAcceptPastedModel = (parsed: ProposedConstruct[]) => {
    setConstructs(parsed)
    setWarnings([])
    setPreflightPairs([])
    toast.success(`Loaded ${parsed.length} construct${parsed.length === 1 ? "" : "s"}`)
    startTransition(async () => {
      await runLibraryMatch(parsed)
    })
  }

  const handleAssessSoundness = () => {
    setIsAssessing(true)
    startTransition(async () => {
      try {
        setSoundness(
          await assessBuildSoundnessAction(
            build.id,
            constructs.filter((c) => c.name.trim().length > 0)
          )
        )
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not check the model'
        )
      } finally {
        setIsAssessing(false)
      }
    })
  }

  const handleUpdateConstruct = (index: number, field: string, value: unknown) => {
    const updated = [...constructs]
    const construct = { ...updated[index] }

    if (field === 'name') {
      construct.name = String(value)
    } else if (field === 'definition') {
      construct.definition = String(value)
    } else if (field === 'exclusions') {
      construct.exclusions = Array.isArray(value) ? value : []
    }

    updated[index] = construct
    setConstructs(updated)
  }

  const handleDeleteConstruct = (index: number) => {
    setConstructs(constructs.filter((_, i) => i !== index))
  }

  const handleAddConstruct = () => {
    setConstructs([
      ...constructs,
      { name: '', definition: '', exclusions: [] }
    ])
  }

  const handleAddExclusion = (constructIndex: number, exclusion: string) => {
    if (!exclusion.trim()) return
    const updated = [...constructs]
    const construct = { ...updated[constructIndex] }
    construct.exclusions = [...construct.exclusions, exclusion.trim()]
    updated[constructIndex] = construct
    setConstructs(updated)
  }

  const handleRemoveExclusion = (constructIndex: number, exclusionIndex: number) => {
    const updated = [...constructs]
    const construct = { ...updated[constructIndex] }
    construct.exclusions = construct.exclusions.filter((_, i) => i !== exclusionIndex)
    updated[constructIndex] = construct
    setConstructs(updated)
  }

  const handleConfirmStructure = () => {
    // Validate
    const emptyConstructs = constructs.filter(c => !c.name.trim() || !c.definition.trim())
    if (emptyConstructs.length > 0) {
      toast.error('All constructs must have a name and definition')
      return
    }

    // Turn the per-construct reuse choices into name -> library construct id, so
    // a construct the author chose to reuse is linked at creation rather than
    // being minted again as a near-duplicate.
    const libraryLinks: Record<string, string> = {}
    for (const [indexKey, decision] of Object.entries(matchDecisions)) {
      if (decision.decision !== 'reuse') continue
      const construct = constructs[Number(indexKey)]
      if (construct?.name.trim()) {
        libraryLinks[construct.name.trim()] = decision.libraryConstructId
      }
    }

    const reuseCount = Object.keys(libraryLinks).length

    startTransition(async () => {
      try {
        await confirmStructureAction(
          build.id,
          constructs as unknown as Array<Record<string, unknown>>,
          preflightPairs.map((p) => ({
            constructAName: p.constructAName,
            constructBName: p.constructBName,
            cosineSimilarity: p.cosineSimilarity,
          })),
          libraryLinks
        )
        toast.success(
          reuseCount > 0
            ? `Created ${constructs.length} blueprint${constructs.length === 1 ? "" : "s"}, reusing ${reuseCount} from your library`
            : `Created ${constructs.length} blueprint${constructs.length === 1 ? "" : "s"}`
        )
        router.push(`/instruments/${build.id}`)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to create blueprints'
        )
      }
    })
  }

  const hasConstructs = constructs.length > 0

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Instruments"
        title={build.name}
        description="Propose a complete construct set with AI"
      >
        <Button
          onClick={() => router.push(`/instruments/${build.id}`)}
          variant="outline"
        >
          Back to build
        </Button>
      </PageHeader>

      {/* Warnings alert */}
      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-semibold text-sm">
                {warnings.length} warning(s) during generation:
              </div>
              <ul className="text-xs space-y-1 list-disc list-inside">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!hasConstructs ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Already have a model? Start from it. */}
          <Card className="p-6 space-y-4">
            <div>
              <p className="text-overline text-[var(--gold)]">Bring your own</p>
              <h2 className="text-lg font-semibold mt-1">Paste your model</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Constructs and definitions you already have. JSON, YAML, a markdown
                list, or one per line.
              </p>
            </div>
            <ModelInput
              value={modelText}
              onChange={setModelText}
              onAccept={handleAcceptPastedModel}
              disabled={isPending || isProposing}
            />
          </Card>

          {/* Or start from nothing. */}
          <Card className="p-6 space-y-4">
            <div>
              <p className="text-overline text-[var(--gold)]">Start from the brief</p>
              <h2 className="text-lg font-semibold mt-1">Let AI propose the set</h2>
              <p className="text-sm text-muted-foreground mt-1">
                A complete construct set drawn from your brief, measure type and
                audience. You can edit everything afterwards.
              </p>
            </div>
            <Button
              onClick={() => handleProposeStructure('fresh')}
              disabled={isPending || isProposing}
              size="lg"
            >
              {isProposing ? 'Proposing constructs...' : 'Propose constructs with AI'}
            </Button>
          </Card>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Constructs editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Constructs ({constructs.length})
              </h2>
              <div className="flex items-center gap-2">
                {/* Gap-fill keeps what is on screen and asks only for the rest.
                    Regenerate throws it all away — which used to be the only
                    option, and quietly discarded hand-written constructs. */}
                <Button
                  onClick={() => handleProposeStructure('fill-gaps')}
                  variant="outline"
                  size="sm"
                  disabled={isPending || isProposing}
                >
                  Fill gaps with AI
                </Button>
                <Button
                  onClick={() => handleProposeStructure('fresh')}
                  variant="ghost"
                  size="sm"
                  disabled={isPending || isProposing}
                >
                  Regenerate all
                </Button>
              </div>
            </div>

            <SoundnessPanel
              report={soundness}
              isRunning={isAssessing}
              onRun={handleAssessSoundness}
            />

            <LibraryMatchList
              results={matchResults}
              decisions={matchDecisions}
              onDecide={(decision) =>
                setMatchDecisions((prev) => ({ ...prev, [decision.constructIndex]: decision }))
              }
              proposedDefinitions={Object.fromEntries(
                constructs.map((c, i) => [i, c.definition])
              )}
              isLoading={isMatching}
            />

            <div className="space-y-4">
              {constructs.map((construct, idx) => (
                <Card key={idx} className="p-6">
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2 block">
                        Construct name
                      </label>
                      <input
                        type="text"
                        value={construct.name}
                        onChange={(e) => handleUpdateConstruct(idx, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="E.g., Adaptability, Communication, etc."
                      />
                    </div>

                    {/* Definition */}
                    <div>
                      <label className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2 block">
                        Definition (60–100 words)
                      </label>
                      <textarea
                        value={construct.definition}
                        onChange={(e) => handleUpdateConstruct(idx, 'definition', e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        rows={4}
                        placeholder="A clear, behavioural definition of what this construct measures..."
                      />
                    </div>

                    {/* Exclusions */}
                    <div>
                      <label className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2 block">
                        Exclusions (what this does NOT measure)
                      </label>
                      <div className="space-y-2">
                        {construct.exclusions.map((exclusion, exIdx) => (
                          <div
                            key={exIdx}
                            className="flex items-start gap-2 p-2 bg-muted rounded text-sm"
                          >
                            <div className="flex-1">{exclusion}</div>
                            <button
                              onClick={() => handleRemoveExclusion(idx, exIdx)}
                              className="text-muted-foreground hover:text-foreground text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <input
                          type="text"
                          placeholder="Add an exclusion and press Enter..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddExclusion(idx, e.currentTarget.value)
                              e.currentTarget.value = ''
                            }
                          }}
                          className="w-full px-3 py-2 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    {/* Delete button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleDeleteConstruct(idx)}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        Delete construct
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Button
              onClick={handleAddConstruct}
              variant="outline"
              className="w-full"
            >
              Add another construct
            </Button>
          </div>

          {/* Discriminability matrix */}
          {preflightPairs.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">Discriminability Review</h2>
                <Alert className="mb-4">
                  <AlertDescription className="text-sm">
                    Similarity and discrimination results are heuristics for human review, not automated gates.
                    Measured separation on this platform is Cohen&rsquo;s d ~ 0.63–1.03.
                    Review high-overlap pairs below to ensure constructs are genuinely distinct.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="space-y-3">
                {preflightPairs.map((pair, idx) => {
                  const statusColors = {
                    green: 'border-green-300 bg-green-50 dark:bg-green-950/20',
                    amber: 'border-amber-300 bg-amber-50 dark:bg-amber-950/20',
                    red: 'border-red-300 bg-red-50 dark:bg-red-950/20',
                  }
                  const statusBadgeColors = {
                    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
                    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
                    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
                  }
                  const statusLabels = {
                    green: 'Distinct',
                    amber: 'Review',
                    red: 'Similar',
                  }

                  return (
                    <Card
                      key={idx}
                      className={`p-4 ${statusColors[pair.status]}`}
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-semibold">
                              {pair.constructAName} ↔ {pair.constructBName}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Similarity: {(pair.cosineSimilarity * 100).toFixed(1)}%
                              {pair.reviewedByLlm && ' (LLM reviewed)'}
                            </div>
                          </div>
                          <Badge className={`shrink-0 ${statusBadgeColors[pair.status]}`}>
                            {statusLabels[pair.status]}
                          </Badge>
                        </div>

                        {/* Overlap summary */}
                        {pair.overlapSummary && (
                          <div className="text-xs space-y-1">
                            <div className="font-semibold text-foreground">Overlap:</div>
                            <div className="text-muted-foreground">{pair.overlapSummary}</div>
                          </div>
                        )}

                        {/* Shared signals */}
                        {pair.sharedSignals && pair.sharedSignals.length > 0 && (
                          <div className="text-xs space-y-1">
                            <div className="font-semibold text-foreground">Shared signals:</div>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {pair.sharedSignals.map((signal, sidx) => (
                                <li key={sidx}>{signal}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Unique signals A */}
                        {pair.uniqueSignalsA && pair.uniqueSignalsA.length > 0 && (
                          <div className="text-xs space-y-1">
                            <div className="font-semibold text-foreground">Unique to {pair.constructAName}:</div>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {pair.uniqueSignalsA.map((signal, sidx) => (
                                <li key={sidx}>{signal}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Unique signals B */}
                        {pair.uniqueSignalsB && pair.uniqueSignalsB.length > 0 && (
                          <div className="text-xs space-y-1">
                            <div className="font-semibold text-foreground">Unique to {pair.constructBName}:</div>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {pair.uniqueSignalsB.map((signal, sidx) => (
                                <li key={sidx}>{signal}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Refinement guidance */}
                        {(pair.refinementGuidanceA || pair.refinementGuidanceB) && (
                          <div className="text-xs space-y-1 border-t pt-2">
                            {pair.refinementGuidanceA && (
                              <div className="space-y-1">
                                <div className="font-semibold text-foreground">Guidance for {pair.constructAName}:</div>
                                <div className="text-muted-foreground">{pair.refinementGuidanceA}</div>
                              </div>
                            )}
                            {pair.refinementGuidanceB && (
                              <div className="space-y-1">
                                <div className="font-semibold text-foreground">Guidance for {pair.constructBName}:</div>
                                <div className="text-muted-foreground">{pair.refinementGuidanceB}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* LLM explanation */}
                        {pair.llmExplanation && (
                          <div className="text-xs space-y-1 border-t pt-2">
                            <div className="font-semibold text-foreground">Analysis:</div>
                            <div className="text-muted-foreground">{pair.llmExplanation}</div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Confirmation section */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              onClick={() => router.push(`/instruments/${build.id}`)}
              variant="outline"
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStructure}
              disabled={isPending || constructs.length === 0}
            >
              {isPending ? 'Creating blueprints...' : `Create ${constructs.length} blueprint${constructs.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
