"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Braces, Cpu, MessageSquare, ScanSearch, Sparkles } from "lucide-react"
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollReveal } from "@/components/scroll-reveal"
import { createPromptVersion, type PromptSummaryRow, type PromptVersionRow } from "@/app/actions/prompts"
import type { AIPromptPurpose } from "@/types/database"

const PROMPT_META: Record<AIPromptPurpose, { label: string; description: string; icon: React.ElementType }> = {
  chat: {
    label: "Chat",
    description: "Sets the assistant behavior for the chat workspace.",
    icon: MessageSquare,
  },
  item_generation: {
    label: "Item Generation",
    description: "Controls how new psychometric items are written.",
    icon: Cpu,
  },
  preflight_analysis: {
    label: "Preflight Analysis",
    description: "Controls the discrimination check for overlapping constructs.",
    icon: ScanSearch,
  },
  competency_matching: {
    label: "Competency Matching",
    description: "Controls how competencies are ranked against diagnostic evidence.",
    icon: Sparkles,
  },
  embedding: {
    label: "Embeddings",
    description: "Embedding tasks do not use a system prompt.",
    icon: Braces,
  },
  ranking_explanation: {
    label: "Ranking Explanation",
    description: "Not yet wired to a runtime prompt.",
    icon: Braces,
  },
  diagnostic_analysis: {
    label: "Diagnostic Analysis",
    description: "Not yet wired to a runtime prompt.",
    icon: Braces,
  },
}

interface PromptEditorFormProps {
  prompts: Array<{
    purpose: AIPromptPurpose
    summary: PromptSummaryRow | null
    versions: PromptVersionRow[]
  }>
}

function PromptCard({
  purpose,
  summary,
  versions,
  index,
}: PromptEditorFormProps["prompts"][number] & { index: number }) {
  const router = useRouter()
  const meta = PROMPT_META[purpose]
  const Icon = meta.icon
  const activeContent = summary?.activePrompt?.content ?? ""
  const [draft, setDraft] = useState(activeContent)
  const [persistedDraft, setPersistedDraft] = useState(activeContent)
  const [isPending, startTransition] = useTransition()
  const isDirty = draft.trim() !== persistedDraft.trim()

  const activeVersion = useMemo(
    () => versions.find((version) => version.isActive) ?? summary?.activePrompt ?? null,
    [summary?.activePrompt, versions],
  )

  function handleSave() {
    startTransition(async () => {
      const result = await createPromptVersion(purpose, draft, activeVersion?.name)
      if ("error" in result) {
        toast.error(result.error)
        return
      }

      setPersistedDraft(draft)
      toast.success(`${meta.label} prompt saved as a new active version`)
      router.refresh()
    })
  }

  return (
    <ScrollReveal delay={index * 60}>
      <Card variant="interactive">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{meta.label}</p>
                {activeVersion ? (
                  <Badge variant="outline">v{activeVersion.version}</Badge>
                ) : (
                  <Badge variant="outline">Unconfigured</Badge>
                )}
              </div>
              <p className="text-caption text-muted-foreground mt-0.5">{meta.description}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Configure the ${meta.label.toLowerCase()} system prompt`}
            className="min-h-48 font-mono text-xs"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-muted-foreground">
              {versions.length > 0
                ? `${versions.length} version${versions.length === 1 ? "" : "s"} stored`
                : "No prompt versions stored yet"}
            </p>
            <Button onClick={handleSave} disabled={!draft.trim() || !isDirty || isPending}>
              {isPending ? "Saving..." : "Save as new active version"}
            </Button>
          </div>

          <Accordion>
            <AccordionItem value={`${purpose}-history`}>
              <AccordionTrigger>Version history</AccordionTrigger>
              <AccordionPanel className="space-y-2 px-1 pb-1">
                {versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No versions yet.</p>
                ) : (
                  versions.map((version) => (
                    <div key={version.id} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">v{version.version}</Badge>
                          {version.isActive && <Badge>Active</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                        {version.content}
                      </p>
                    </div>
                  ))
                )}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}

export function PromptEditorForm({ prompts }: PromptEditorFormProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {prompts.map((prompt, index) => (
        <PromptCard key={prompt.purpose} {...prompt} index={index} />
      ))}
    </div>
  )
}
