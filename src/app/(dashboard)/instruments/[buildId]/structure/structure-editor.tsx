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
} from '@/app/actions/instrument'

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

  const handleProposeStructure = () => {
    setIsProposing(true)
    startTransition(async () => {
      try {
        const result = await proposeStructureAction(build.id)
        setConstructs(result.constructs)
        setPreflightPairs(result.preflightPairs)
        setWarnings(result.warnings)
        if (result.warnings.length > 0) {
          toast.info(`Generated with ${result.warnings.length} warning(s)`)
        } else {
          toast.success(`Generated ${result.constructs.length} constructs`)
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to propose constructs'
        )
        setConstructs([])
        setPreflightPairs([])
      } finally {
        setIsProposing(false)
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

    startTransition(async () => {
      try {
        // Pass the overlap pairs so they persist as evidence and reach the
        // technical report's discriminant section. Without this the pairs are
        // computed, shown on screen, and then thrown away — the report then
        // reports no pairwise comparison, which reads as "none was done".
        await confirmStructureAction(
          build.id,
          constructs as unknown as Array<Record<string, unknown>>,
          preflightPairs.map((p) => ({
            constructAName: p.constructAName,
            constructBName: p.constructBName,
            cosineSimilarity: p.cosineSimilarity
          }))
        )
        toast.success(`Created ${constructs.length} blueprint(s)`)
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
        <Card className="p-12">
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">No constructs proposed yet</h2>
              <p className="text-muted-foreground mt-2">
                Use AI to generate a complete construct set based on your instrument brief, measure type, and audience.
              </p>
            </div>
            <Button
              onClick={handleProposeStructure}
              disabled={isPending || isProposing}
              size="lg"
            >
              {isProposing ? 'Proposing constructs...' : 'Propose constructs with AI'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Constructs editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Constructs ({constructs.length})
              </h2>
              <Button
                onClick={handleProposeStructure}
                variant="outline"
                size="sm"
                disabled={isPending || isProposing}
              >
                Regenerate
              </Button>
            </div>

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
              {isPending ? 'Creating blueprints...' : `Create ${constructs.length} blueprint(s)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
