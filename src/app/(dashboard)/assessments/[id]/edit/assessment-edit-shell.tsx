"use client"

import { usePathname } from "next/navigation"
import { Lock } from "lucide-react"
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
  customReportLockName,
  basePath,
  children,
}: {
  assessment: { id: string; title: string; status: string }
  customReportLockName: string | null
  /** Edit root path — defaults to /assessments/[id]/edit (admin portal). */
  basePath?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const editRoot = basePath ?? `/assessments/${assessment.id}/edit`

  const afterBase = pathname.startsWith(editRoot)
    ? pathname.slice(editRoot.length).replace(/^\/+/, "").split("/")[0]
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

      {customReportLockName && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3 text-sm">
          <Lock className="size-4 mt-0.5 shrink-0 text-amber-700" />
          <div className="text-amber-900">
            <p className="font-medium">Taxonomy locked by a custom report.</p>
            <p className="mt-1 text-amber-900/85">
              This assessment is bound to{" "}
              <span className="font-medium">&ldquo;{customReportLockName}&rdquo;</span>, a
              hand-coded report that depends on a specific construct and factor set.
              Composition, customisation, and scoring-level changes are disabled while
              it&apos;s attached. To customise the assessment, remove the custom report on
              the Reports tab first.
            </p>
          </div>
        </div>
      )}

      <RouteTabs tabs={TABS} basePath={editRoot} activeSegment={activeSegment} />

      {children}
    </div>
  )
}
