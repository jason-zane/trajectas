'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { previewPublish, publishBuild, unpublishBuild } from '@/app/actions/instrument'
import type { InstrumentBuildDto, InstrumentBlueprintDto, InstrumentCandidateItemDto } from '@/lib/dal/instrument-mappers'

interface PublishViewProps {
  buildId: string
  build: InstrumentBuildDto
  blueprints: InstrumentBlueprintDto[]
  candidateItems: InstrumentCandidateItemDto[]
  responseFormats: Array<{ id: string; name: string; type: string }>
  dimensions: Array<{ id: string; name: string; slug: string }>
}

interface PreviewData {
  constructsToCreate: Array<{ blueprintId: string; name: string; slug: string }>
  constructsToReuse: Array<{ blueprintId: string; name: string; constructId: string }>
  factorsToCreate: Array<{ blueprintId: string; name: string; slug: string }>
  itemsToPublish: number
  itemsAlreadyPublished: number
  blockers: string[]
  warnings: string[]
}

interface PublishResult {
  constructsCreated: number
  factorsCreated: number
  itemsPublished: number
  skipped: number
  warnings: string[]
}

export function PublishView({
  buildId,
  responseFormats,
  dimensions,
}: PublishViewProps) {
  const router = useRouter()
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<string>('')
  const [selectedDimension, setSelectedDimension] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Load preview on mount
  useEffect(() => {
    const loadPreview = async () => {
      try {
        setIsLoading(true)
        const data = await previewPublish(buildId)
        setPreview(data)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load publish preview'
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadPreview()
  }, [buildId])

  const hasBlockers = preview && (preview.blockers.length > 0 || preview.itemsToPublish === 0)
  const canPublish = !hasBlockers && selectedFormat && !isPending
  const isAlreadyPublished = preview && preview.itemsAlreadyPublished > 0

  const handlePublish = () => {
    if (!canPublish) return

    startTransition(async () => {
      try {
        const publishResult = await publishBuild(buildId, {
          responseFormatId: selectedFormat,
          dimensionId: selectedDimension || null,
        })
        setResult(publishResult)
        toast.success('Instrument published to library', {
          description: `${publishResult.itemsPublished} items published`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to publish instrument'
        toast.error(message)
      }
    })
  }

  const handleUnpublish = () => {
    if (!isAlreadyPublished) return

    startTransition(async () => {
      try {
        const unpublishResult = await unpublishBuild(buildId)
        setResult(null)
        toast.success('Instrument unpublished', {
          description: `${unpublishResult.itemsUnpublished} items soft-deleted from library`,
        })
        // Reload preview
        const data = await previewPublish(buildId)
        setPreview(data)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to unpublish instrument'
        )
      }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-4xl">
        <PageHeader
          eyebrow="Publish"
          title="Publish to Library"
          description="Loading preview..."
        />
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="space-y-8 max-w-4xl">
        <PageHeader
          eyebrow="Publish"
          title="Publish to Library"
          description="An error occurred while loading the preview."
        />
      </div>
    )
  }

  // Successful publish: show result summary
  if (result) {
    return (
      <div className="space-y-8 max-w-4xl">
        <PageHeader
          eyebrow="Publish"
          title="Published"
          description="Your instrument has been written to the library."
        />

        <Card className="border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex gap-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">
                Publish successful
              </h3>
              <p className="text-sm text-emerald-600/90 dark:text-emerald-400/90 mt-2">
                {result.itemsPublished} item{result.itemsPublished === 1 ? '' : 's'} published to the live library.
              </p>
            </div>
          </div>
        </Card>

        {/* Summary of created/reused constructs and factors */}
        <div className="space-y-6">
          {result.constructsCreated > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3 text-sm">Created Constructs</h3>
              <p className="text-sm text-foreground">{result.constructsCreated} construct{result.constructsCreated === 1 ? '' : 's'} created</p>
            </Card>
          )}

          {result.factorsCreated > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3 text-sm">Created Factors</h3>
              <p className="text-xs text-muted-foreground mb-3">
                These factors are NOT match-eligible and marked as draft. Promote them deliberately after validation.
              </p>
              <p className="text-sm text-foreground">{result.factorsCreated} factor{result.factorsCreated === 1 ? '' : 's'} created</p>
            </Card>
          )}

          {result.skipped > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3 text-sm">Already Published</h3>
              <p className="text-sm text-foreground">{result.skipped} item{result.skipped === 1 ? '' : 's'} were already published and were skipped</p>
            </Card>
          )}

          {result.warnings.length > 0 && (
            <Card className="p-6 border-amber-500/30 bg-amber-500/5">
              <h3 className="font-semibold mb-3 text-sm text-amber-700 dark:text-amber-400">Warnings</h3>
              <ul className="space-y-1 list-disc list-inside text-xs text-amber-600 dark:text-amber-400">
                {result.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Unpublish control */}
        <div className="flex gap-2">
          <Button
            onClick={handleUnpublish}
            variant="outline"
            disabled={isPending}
          >
            {isPending ? 'Unpublishing…' : 'Unpublish'}
          </Button>
          <Button
            onClick={() => router.push(`/instruments/${buildId}`)}
          >
            Back to build
          </Button>
        </div>
      </div>
    )
  }

  // Pre-publish: show preview with blockers, warnings, and selectors
  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        eyebrow="Publish"
        title="Publish to Library"
        description="Review what will be written to the live library before confirming."
      />

      {/* Blockers section */}
      {preview.blockers.length > 0 && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive dark:text-red-400 text-sm">
            <div className="font-semibold mb-2">Cannot publish — resolve these blockers:</div>
            <ul className="space-y-1 list-disc list-inside">
              {preview.blockers.map((blocker, idx) => (
                <li key={idx}>{blocker}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {preview.itemsToPublish === 0 && preview.blockers.length === 0 && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive dark:text-red-400 text-sm">
            No items to publish. Generate and accept candidate items before publishing.
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings section */}
      {preview.warnings.length > 0 && !hasBlockers && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
            <div className="font-semibold mb-2">Warnings (non-blocking):</div>
            <ul className="space-y-1 list-disc list-inside">
              {preview.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* What will be written */}
      <Card className="p-6">
        <h3 className="font-semibold text-sm mb-4">What will be written to the library</h3>
        <div className="space-y-4">
          {/* Constructs summary */}
          <div>
            <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">
              Constructs
            </div>
            <div className="space-y-2">
              {preview.constructsToCreate.map((construct) => (
                <div key={construct.blueprintId} className="flex items-center gap-3 text-sm">
                  <Badge variant="default" className="text-xs flex-shrink-0">
                    Create
                  </Badge>
                  <span>{construct.name}</span>
                </div>
              ))}
              {preview.constructsToReuse.map((construct) => (
                <div key={construct.blueprintId} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    Reuse
                  </Badge>
                  <span>{construct.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Items summary */}
          <div className="border-t pt-4">
            <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">
              Items
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {preview.itemsToPublish}
                </div>
                <p className="text-xs text-muted-foreground">to publish</p>
              </div>
              {preview.itemsAlreadyPublished > 0 && (
                <div>
                  <div className="text-lg font-semibold tabular-nums">{preview.itemsAlreadyPublished}</div>
                  <p className="text-xs text-muted-foreground">already published</p>
                </div>
              )}
              <div>
                <div className="text-lg font-semibold tabular-nums">{preview.factorsToCreate.length}</div>
                <p className="text-xs text-muted-foreground">factors to create</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Response format selector (required) */}
      <Card className="p-6 border-2 border-primary/20">
        <div className="space-y-4">
          <div>
            <Label htmlFor="format" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Response Format
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Required. Select the format for published items.
            </p>
          </div>
          <Select value={selectedFormat} onValueChange={(value) => setSelectedFormat(value || '')}>
            <SelectTrigger id="format" disabled={isPending}>
              <SelectValue>
                {responseFormats.find((f) => f.id === selectedFormat)?.name || 'Select format'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {responseFormats.map((format) => (
                <SelectItem key={format.id} value={format.id}>
                  {format.name}
                  {format.type && (
                    <span className="text-xs text-muted-foreground ml-2">({format.type})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Dimension selector (optional) */}
      {dimensions.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="dimension" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dimension
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Assign the created factors to a dimension.
              </p>
            </div>
            <Select value={selectedDimension} onValueChange={(value) => setSelectedDimension(value || '')}>
              <SelectTrigger id="dimension" disabled={isPending}>
                <SelectValue>
                  {dimensions.find((d) => d.id === selectedDimension)?.name || 'Select dimension (optional)'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {dimensions.map((dimension) => (
                  <SelectItem key={dimension.id} value={dimension.id}>
                    {dimension.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* Publication info banner */}
      <Alert className="bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
        <AlertDescription className="text-xs text-muted-foreground space-y-2">
          <p>
            <span className="font-semibold">Published items land as DRAFT.</span> Nothing appears in
            client-facing paths until you activate them deliberately.
          </p>
          <p>
            <span className="font-semibold">Created factors are NOT match-eligible.</span> Promote them
            to the matcher after validation.
          </p>
        </AlertDescription>
      </Alert>

      {/* Publish button */}
      <div className="flex gap-2">
        <Button
          onClick={handlePublish}
          disabled={!canPublish}
          size="lg"
        >
          {isPending ? 'Publishing…' : 'Publish to Library'}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        {/* Unpublish has to be reachable on a fresh page load, not just in the
            transient post-publish state — otherwise publishing, navigating away
            and coming back leaves no way to undo. */}
        {preview.itemsAlreadyPublished > 0 && (
          <Button
            variant="ghost"
            onClick={handleUnpublish}
            disabled={isPending}
            className="ml-auto text-destructive hover:text-destructive"
          >
            {isPending
              ? 'Unpublishing…'
              : `Unpublish ${preview.itemsAlreadyPublished} item${preview.itemsAlreadyPublished === 1 ? '' : 's'}`}
          </Button>
        )}
      </div>
    </div>
  )
}
