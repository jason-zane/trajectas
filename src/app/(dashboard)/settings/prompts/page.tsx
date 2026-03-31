import Link from "next/link"
import { Braces, Cpu, MessageSquare, ScanSearch, Sparkles, ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollReveal } from "@/components/scroll-reveal"
import { getPromptSummaries } from "@/app/actions/prompts"
import type { AIPromptPurpose } from "@/types/database"

const PROMPT_META: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  chat: { label: "Chat", description: "Assistant behavior for the chat workspace", icon: MessageSquare },
  item_generation: { label: "Item Generation (Construct)", description: "How new psychometric items are written", icon: Cpu },
  factor_item_generation: { label: "Item Generation (Factor)", description: "How factor-level behavioural items are written", icon: Cpu },
  preflight_analysis: { label: "Preflight Analysis", description: "Discrimination check for overlapping constructs", icon: ScanSearch },
  competency_matching: { label: "Competency Matching", description: "Ranking competencies against diagnostic evidence", icon: Sparkles },
  ranking_explanation: { label: "Ranking Explanation", description: "Plain-language explanations for rankings", icon: Braces },
  diagnostic_analysis: { label: "Diagnostic Analysis", description: "Assessment result insights", icon: Braces },
}

const PROMPT_ORDER: AIPromptPurpose[] = [
  "chat",
  "item_generation",
  "factor_item_generation",
  "preflight_analysis",
  "competency_matching",
  "ranking_explanation",
  "diagnostic_analysis",
]

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default async function PromptSettingsPage() {
  const summaries = await getPromptSummaries()
  const summaryMap = new Map(summaries.map((s) => [s.purpose, s]))

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Settings"
        title="AI Prompts"
        description="System prompts that drive the live AI workflows. Click a prompt to edit or view version history."
      />

      <ScrollReveal>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prompt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead className="hidden sm:table-cell">Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROMPT_ORDER.map((purpose) => {
                const meta = PROMPT_META[purpose]
                const summary = summaryMap.get(purpose)
                const active = summary?.activePrompt
                const Icon = meta?.icon ?? Braces

                return (
                  <TableRow key={purpose} className="group">
                    <TableCell>
                      <Link
                        href={`/settings/prompts/${purpose}`}
                        className="flex items-center gap-3 -my-1"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight">{meta?.label ?? purpose}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {meta?.description ?? ""}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {active ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not configured
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {active ? (
                        <span className="text-sm font-medium">v{active.version}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {summary?.versionCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {active ? timeAgo(active.updatedAt ?? active.createdAt) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/settings/prompts/${purpose}`}>
                        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </ScrollReveal>
    </div>
  )
}
