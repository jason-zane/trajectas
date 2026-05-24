import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Plus, ChevronRight } from "lucide-react"

import { listGenerationPresets } from "@/app/actions/generation-presets"

export const dynamic = "force-dynamic"

export default async function GenerationPresetsPage() {
  const presets = await listGenerationPresets()

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Library"
          title="Generation playbooks"
          description="Reusable playbooks for the AI item generator. Each carries a writing rubric and exemplar items that get injected into prompts at run time."
        />
        <Link href="/generate/presets/new">
          <Button>
            <Plus className="size-4" /> New playbook
          </Button>
        </Link>
      </div>

      {presets.length === 0 ? (
        <EmptyState
          title="No playbooks yet"
          description="Create the first playbook to set defaults for a kind of assessment."
          eyebrow="LIBRARY"
          actionLabel="New playbook"
          actionHref="/generate/presets/new"
        />
      ) : (
        <div className="space-y-2">
          {presets.map((p) => (
            <Link
              key={p.id}
              href={`/generate/presets/${p.id}`}
              className="block"
            >
              <Card variant="interactive">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <Badge variant="secondary" className="capitalize">
                        {p.measurementMode}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {p.useContext}
                      </Badge>
                      {p.audience?.level && (
                        <Badge variant="outline" className="capitalize">
                          {p.audience.level}
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {p.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {p.exemplars.length} exemplar
                      {p.exemplars.length === 1 ? "" : "s"} ·{" "}
                      {p.recommendedTargetPerConstruct} items per construct ·{" "}
                      <span className="font-mono text-[10px] uppercase tracking-wider">
                        {p.critiqueStrictness}
                      </span>{" "}
                      critique
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
