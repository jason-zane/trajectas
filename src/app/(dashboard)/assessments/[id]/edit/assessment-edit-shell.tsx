"use client"

import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { RouteTabs } from "@/components/route-tabs"

const STATUS_VARIANT: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  draft: "secondary",
  active: "default",
  archived: "outline",
}

const TABS = [
  { label: "Overview", segment: "overview" },
  { label: "Composition", segment: "composition" },
  { label: "Presentation", segment: "presentation" },
  { label: "Intro", segment: "intro" },
  { label: "Reports", segment: "reports" },
  { label: "Settings", segment: "settings" },
]

export function AssessmentEditShell({
  assessment,
  children,
}: {
  assessment: { id: string; title: string; status: string }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const basePath = `/assessments/${assessment.id}/edit`

  const afterBase = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length).replace(/^\/+/, "").split("/")[0]
    : ""
  const activeSegment =
    TABS.find((t) => t.segment === afterBase)?.segment ?? "overview"

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Assessment"
        title={assessment.title || "Untitled assessment"}
      >
        <Badge
          variant={STATUS_VARIANT[assessment.status] ?? "secondary"}
          className="capitalize"
        >
          {assessment.status}
        </Badge>
      </PageHeader>

      <RouteTabs tabs={TABS} basePath={basePath} activeSegment={activeSegment} />

      {children}
    </div>
  )
}
