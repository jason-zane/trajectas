'use client'

import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConstructMatchResult } from '@/lib/instrument/library-match'

/**
 * Decision union for what to do with a proposed construct.
 * Either reuse an exact library construct or create a new one.
 */
export type MatchDecision =
  | { constructIndex: number; decision: 'reuse'; libraryConstructId: string }
  | { constructIndex: number; decision: 'create_new' }

/**
 * Props for the library match list component.
 */
export interface LibraryMatchListProps {
  /** Match results for all proposed constructs, ranked by similarity. */
  results: ConstructMatchResult[]

  /** Current decision for each construct index; empty if not yet decided. */
  decisions: Record<number, MatchDecision>

  /** Called when the user selects a decision. */
  onDecide: (decision: MatchDecision) => void

  /** Optional proposed definitions to show side-by-side with library definitions. */
  proposedDefinitions?: Record<number, string>

  /** True if match results are being loaded; shows shimmer skeletons. */
  isLoading?: boolean

  /** Optional CSS class name. */
  className?: string
}

/**
 * Displays library matches for proposed constructs and lets the author decide
 * whether to reuse each or create new. Only shows constructs that have matches;
 * constructs with no matches are omitted entirely (silent pass).
 *
 * Handles loading state with shimmer skeletons, exact name matching callouts,
 * side-by-side definition comparison, and inheritance preview.
 */
export function LibraryMatchList({
  results,
  decisions,
  onDecide,
  proposedDefinitions,
  isLoading = false,
  className,
}: LibraryMatchListProps) {
  // Filter to only constructs with matches
  const constructsWithMatches = results.filter((r) => r.matches.length > 0)

  // If nothing has matches and not loading, render nothing
  if (!isLoading && constructsWithMatches.length === 0) {
    return null
  }

  // Loading state: shimmer skeletons
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={idx} className="overflow-hidden">
            <CardHeader className="border-b">
              <div className="h-5 w-40 bg-muted/40 rounded animate-shimmer" />
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, jdx) => (
                  <div key={jdx} className="space-y-3 p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2 justify-between">
                      <div className="h-4 w-32 bg-muted/40 rounded animate-shimmer" />
                      <div className="h-4 w-12 bg-muted/40 rounded animate-shimmer" />
                    </div>
                    <div className="h-3 w-full bg-muted/40 rounded animate-shimmer" />
                    <div className="h-3 w-2/3 bg-muted/40 rounded animate-shimmer" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {constructsWithMatches.map((result) => {
        const currentDecision = decisions[result.proposedIndex]
        const hasCreatedNew = currentDecision?.decision === 'create_new'

        return (
          <Card key={result.proposedIndex} className="overflow-hidden">
            {/* Header: construct name and recommendation hint */}
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{result.proposedName}</CardTitle>
                {result.recommendation === 'reuse' && (
                  <Badge variant="default" className="text-xs">
                    Recommendation: Reuse
                  </Badge>
                )}
                {result.recommendation === 'review' && (
                  <Badge variant="secondary" className="text-xs">
                    Recommendation: Review
                  </Badge>
                )}
              </div>
            </CardHeader>

            {/* Candidates list */}
            <CardContent className="pt-6">
              <div className="space-y-4">
                {result.matches.map((match) => {
                  const isSelectedReuse =
                    currentDecision?.decision === 'reuse' &&
                    currentDecision.libraryConstructId === match.libraryConstruct.id

                  return (
                    <div
                      key={match.libraryConstruct.id}
                      className={cn(
                        'p-4 border rounded-lg transition-all',
                        isSelectedReuse &&
                          'bg-primary/5 border-primary ring-2 ring-primary/40 shadow-sm',
                      )}
                    >
                      {/* Header row: name, confidence, similarity, inheritance */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium break-all">
                              {match.libraryConstruct.name}
                            </span>
                            {match.nameExact && (
                              <Badge
                                variant="outline"
                                className="border-transparent bg-[var(--gold)]/15 text-[var(--gold)] text-xs whitespace-nowrap"
                              >
                                Same name in library
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={getConfidenceVariant(match.confidence)}>
                            {match.confidence}
                          </Badge>
                          <div className="font-mono text-sm tabular-nums text-muted-foreground">
                            {Math.round(match.similarity * 100)}%
                          </div>
                        </div>
                      </div>

                      {/* Inheritance preview */}
                      {(match.libraryConstruct.itemCount !== undefined ||
                        match.libraryConstruct.factorCount !== undefined) && (
                        <div className="text-xs text-muted-foreground mb-3">
                          Reuse would inherit:{' '}
                          <span className="font-medium">
                            {match.libraryConstruct.itemCount !== undefined &&
                              `${match.libraryConstruct.itemCount} items`}
                            {match.libraryConstruct.itemCount !== undefined &&
                              match.libraryConstruct.factorCount !== undefined &&
                              ' · '}
                            {match.libraryConstruct.factorCount !== undefined &&
                              `${match.libraryConstruct.factorCount} factors`}
                          </span>
                        </div>
                      )}

                      {/* Side-by-side definitions */}
                      {proposedDefinitions?.[result.proposedIndex] &&
                        match.libraryConstruct.definition && (
                          <div className="grid grid-cols-2 gap-4 mb-3 pb-3 border-b">
                            <div>
                              <div className="text-muted-foreground font-mono uppercase text-xs mb-2 tracking-wide">
                                Your definition
                              </div>
                              <p className="text-sm leading-relaxed">
                                {proposedDefinitions[result.proposedIndex]}
                              </p>
                            </div>
                            <div>
                              <div className="text-muted-foreground font-mono uppercase text-xs mb-2 tracking-wide">
                                Library definition
                              </div>
                              <p className="text-sm leading-relaxed">
                                {match.libraryConstruct.definition}
                              </p>
                            </div>
                          </div>
                        )}

                      {/* Definition included caption */}
                      {!match.definitionIncluded && (
                        <p className="text-xs text-muted-foreground mb-3 italic">
                          Library entry has no definition — match is based on name
                          alone and may be weak evidence.
                        </p>
                      )}

                      {/* Reuse button */}
                      <Button
                        size="sm"
                        variant={isSelectedReuse ? 'default' : 'outline'}
                        onClick={() =>
                          onDecide({
                            constructIndex: result.proposedIndex,
                            decision: 'reuse',
                            libraryConstructId: match.libraryConstruct.id,
                          })
                        }
                        className="w-full"
                      >
                        {isSelectedReuse ? '✓ Reusing this' : 'Reuse this'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>

            {/* Create new button */}
            <CardFooter className="border-t bg-muted/30">
              <Button
                size="sm"
                variant={hasCreatedNew ? 'default' : 'ghost'}
                onClick={() =>
                  onDecide({
                    constructIndex: result.proposedIndex,
                    decision: 'create_new',
                  })
                }
                className="w-full"
              >
                {hasCreatedNew ? '✓ Creating new' : 'Create new anyway'}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}

/**
 * Map confidence to a badge variant, descending in prominence.
 *
 * Deliberately NOT destructive at the top end: an exact match is the strongest
 * reason to reuse rather than mint a duplicate, and painting the best candidate
 * red reads as "something is wrong here" when the opposite is true. The warning
 * that genuinely belongs to an exact match — same name, drifted definition — is
 * carried by its own badge, once.
 */
function getConfidenceVariant(
  confidence: 'exact' | 'strong' | 'possible' | 'weak',
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (confidence) {
    case 'exact':
      return 'default'
    case 'strong':
      return 'secondary'
    case 'possible':
    case 'weak':
      return 'outline'
  }
}
