'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { InstrumentBuildDto, InstrumentBlueprintDto } from '@/lib/dal/instrument-mappers'
import { deleteBlueprintAction, restoreBlueprintAction } from '@/app/actions/instrument'

interface BuildDetailProps {
  build: InstrumentBuildDto
  blueprints: InstrumentBlueprintDto[]
}

const MEASURE_TYPE_LABELS: Record<string, string> = {
  trait: 'Trait',
  competency_behavioural: 'Competency (Behavioral)',
  capability: 'Capability',
  sjt: 'Situational Judgment Test',
  forced_choice: 'Forced Choice',
  preference: 'Preference',
  climate: 'Climate',
  validity_scale: 'Validity Scale'
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_COLORS: Record<string, BadgeVariant> = {
  draft: 'default',
  blueprinting: 'secondary',
  generating: 'secondary',
  reviewing: 'secondary',
  ready: 'default',
  published: 'default',
  failed: 'destructive'
}

export function BuildDetail({ build, blueprints }: BuildDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleDeleteBlueprint = (blueprintId: string, label: string) => {
    // Deletion is a soft delete, so the house pattern applies: act immediately
    // and offer Undo rather than gating behind a browser confirm().
    startTransition(async () => {
      try {
        await deleteBlueprintAction(blueprintId)
        router.refresh()
        toast.success(`${label} deleted`, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              startTransition(async () => {
                try {
                  await restoreBlueprintAction(blueprintId)
                  router.refresh()
                  toast.success(`${label} restored`)
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : 'Failed to restore construct'
                  )
                }
              })
            },
          },
        })
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to delete blueprint'
        )
      }
    })
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Instruments"
        title={build.name}
        description={build.brief || `Measure type: ${MEASURE_TYPE_LABELS[build.measureType] || build.measureType}`}
      >
        <Button
          variant="outline"
          onClick={() => router.push(`/instruments/${build.id}/settings`)}
        >
          Edit build
        </Button>
      </PageHeader>

      {/* Build metadata */}
      <Card className="p-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
              Measure Type
            </div>
            <div className="mt-1 font-medium">
              {MEASURE_TYPE_LABELS[build.measureType] || build.measureType}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
              Status
            </div>
            <div className="mt-1">
              <Badge variant={STATUS_COLORS[build.status] ?? 'default'}>
                {build.status}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
              Blueprints
            </div>
            <div className="mt-1 font-medium tabular-nums">
              {blueprints.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
              Created
            </div>
            <div className="mt-1 text-sm">
              {new Date(build.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </Card>

      {/* Blueprints section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Blueprints</h2>
          <Button
            onClick={() => router.push(`/instruments/${build.id}/blueprints/new`)}
            size="sm"
          >
            Create blueprint
          </Button>
        </div>

        {blueprints.length === 0 ? (
          <EmptyState
            title="No blueprints yet"
            description="Create your first blueprint to begin designing the instrument."
            actionLabel="Create blueprint"
            actionHref={`/instruments/${build.id}/blueprints/new`}
          />
        ) : (
          <div className="space-y-3">
            {blueprints.map((blueprint) => (
              <Card
                key={blueprint.id}
                variant="interactive"
                className="group p-4 cursor-pointer"
                onClick={() => router.push(`/instruments/${build.id}/blueprints/${blueprint.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">
                      {blueprint.draftConstructName || blueprint.constructId || 'Untitled'}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {blueprint.draftConstructDefinition || 'No definition provided'}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Target α: {blueprint.targetAlpha ? blueprint.targetAlpha.toFixed(2) : 'Not set'}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{blueprint.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteBlueprint(
                          blueprint.id,
                          blueprint.draftConstructName || 'Construct',
                        )
                      }}
                      disabled={isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
