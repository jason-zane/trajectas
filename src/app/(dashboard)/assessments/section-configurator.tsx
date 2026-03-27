"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  FileQuestion,
  Settings2,
  Sparkles,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollReveal } from "@/components/scroll-reveal"
import { getFormatBreakdown } from "@/app/actions/assessments"
import type { SectionDraft, FormatGroup } from "@/app/actions/assessments"
import type { ItemOrdering } from "@/types/database"

const FORMAT_ICONS: Record<string, string> = {
  likert: "📊",
  binary: "✓✗",
  sjt: "🎯",
  forced_choice: "⚖️",
  free_text: "✏️",
}

const DEFAULT_TITLES: Record<string, string> = {
  likert: "Self-Report Questionnaire",
  binary: "Quick Checks",
  sjt: "Situational Judgement",
  forced_choice: "Forced Choice",
  free_text: "Open Response",
}

const DEFAULT_INSTRUCTIONS: Record<string, string> = {
  likert: "Rate how strongly you agree or disagree with each statement.",
  binary: "Indicate whether each statement applies to you.",
  sjt: "Read each scenario carefully and rate the effectiveness of each response option.",
  forced_choice: "For each group of statements, select the one most like you and the one least like you.",
  free_text: "Please provide a detailed response to each prompt.",
}

const ORDERING_INFO: Record<ItemOrdering, { label: string; description: string }> = {
  interleaved_by_construct: {
    label: "Interleaved by construct",
    description: "Round-robin across constructs — prevents pattern detection and balances exposure.",
  },
  randomised: {
    label: "Randomised",
    description: "Full shuffle for each candidate — maximises faking resistance.",
  },
  fixed: {
    label: "Fixed order",
    description: "Exact order set by the admin — best for carefully sequenced items.",
  },
}

function defaultSectionFromFormat(group: FormatGroup, order: number): SectionDraft {
  return {
    responseFormatId: group.responseFormatId,
    formatName: group.formatName,
    formatType: group.formatType,
    title: DEFAULT_TITLES[group.formatType] ?? "Assessment Section",
    instructions: DEFAULT_INSTRUCTIONS[group.formatType] ?? "",
    displayOrder: order,
    itemOrdering: group.formatType === "sjt" ? "fixed" : "interleaved_by_construct",
    itemsPerPage: group.formatType === "sjt" ? 1 : null,
    timeLimitSeconds: null,
    allowBackNav: true,
    itemCount: group.itemCount,
  }
}

interface SectionConfiguratorProps {
  factorIds: string[]
  sections: SectionDraft[]
  onSectionsChange: (sections: SectionDraft[]) => void
  existingSections?: SectionDraft[]
}

export function SectionConfigurator({
  factorIds,
  sections,
  onSectionsChange,
  existingSections,
}: SectionConfiguratorProps) {
  const [loading, setLoading] = useState(false)
  const [formatGroups, setFormatGroups] = useState<FormatGroup[]>([])

  // Fetch format breakdown when factors change
  useEffect(() => {
    if (factorIds.length === 0) {
      setFormatGroups([])
      onSectionsChange([])
      return
    }

    let cancelled = false
    setLoading(true)

    getFormatBreakdown(factorIds).then((groups) => {
      if (cancelled) return
      setFormatGroups(groups)
      setLoading(false)

      // Auto-generate sections if none exist yet
      if (existingSections && existingSections.length > 0) {
        // Merge existing sections with updated item counts
        const updated = existingSections.map((es) => {
          const matching = groups.find((g) => g.responseFormatId === es.responseFormatId)
          return { ...es, itemCount: matching?.itemCount ?? es.itemCount }
        })
        onSectionsChange(updated)
      } else if (sections.length === 0 || !sectionsMatchGroups(sections, groups)) {
        const autoSections = groups.map((g, i) => defaultSectionFromFormat(g, i))
        onSectionsChange(autoSections)
      }
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factorIds.join(",")])

  const updateSection = useCallback(
    (index: number, updates: Partial<SectionDraft>) => {
      onSectionsChange(
        sections.map((s, i) => (i === index ? { ...s, ...updates } : s))
      )
    },
    [sections, onSectionsChange]
  )

  if (factorIds.length === 0) return null
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 animate-pulse" />
            Analysing item formats...
          </div>
        </CardContent>
      </Card>
    )
  }
  if (formatGroups.length === 0) return null

  const totalItems = sections.reduce((sum, s) => sum + s.itemCount, 0)
  const isMultiFormat = sections.length > 1

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Layers className="size-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>Assessment Sections</CardTitle>
            <CardDescription>
              {isMultiFormat
                ? `Your assessment includes ${sections.length} item formats. We\u2019ve organised them into sections for you.`
                : `All ${totalItems} items use the same format \u2014 they\u2019ll be presented as a single section.`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {sections.map((section) => (
            <Badge key={section.responseFormatId} variant="secondary" className="gap-1.5">
              <span>{FORMAT_ICONS[section.formatType] ?? "📋"}</span>
              {section.formatName}
              <span className="text-muted-foreground">({section.itemCount})</span>
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">
            {totalItems} items total
          </span>
        </div>

        {/* Section cards — always show for multi-format, collapsible for single */}
        {isMultiFormat ? (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <ScrollReveal key={section.responseFormatId} delay={index * 60}>
                <SectionCard
                  section={section}
                  index={index}
                  onChange={(updates) => updateSection(index, updates)}
                  defaultExpanded={false}
                />
              </ScrollReveal>
            ))}

            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
              <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Candidates will see a brief instruction card between sections explaining the new format. Items within each section only use that section&apos;s format.
              </p>
            </div>
          </div>
        ) : (
          <SingleSectionSummary section={sections[0]} onChange={(updates) => updateSection(0, updates)} />
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Single-format summary (collapsed view with expandable config)
// ---------------------------------------------------------------------------

function SingleSectionSummary({
  section,
  onChange,
}: {
  section: SectionDraft
  onChange: (updates: Partial<SectionDraft>) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-primary hover:underline"
      >
        <Settings2 className="size-3.5" />
        {expanded ? "Hide" : "Customise"} section settings
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <div className="animate-fade-in-up">
          <SectionFields section={section} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section card (for multi-format view)
// ---------------------------------------------------------------------------

function SectionCard({
  section,
  index,
  onChange,
  defaultExpanded,
}: {
  section: SectionDraft
  index: number
  onChange: (updates: Partial<SectionDraft>) => void
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-lg leading-none">{FORMAT_ICONS[section.formatType] ?? "📋"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{section.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {section.formatName}
            </Badge>
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <FileQuestion className="size-3" />
              {section.itemCount} items
            </span>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 tabular-nums">
          Section {index + 1}
        </Badge>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 animate-fade-in-up">
          <SectionFields section={section} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared section fields
// ---------------------------------------------------------------------------

function SectionFields({
  section,
  onChange,
}: {
  section: SectionDraft
  onChange: (updates: Partial<SectionDraft>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs">Section Title</Label>
          <Input
            value={section.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Self-Report Questionnaire"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs">Instructions for Candidates</Label>
          <Textarea
            value={section.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            placeholder="Shown at the start of this section..."
            className="min-h-16 text-sm"
          />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Item Ordering</Label>
          <Select
            value={section.itemOrdering}
            onValueChange={(v) => onChange({ itemOrdering: v as ItemOrdering })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORDERING_INFO).map(([value, info]) => (
                <SelectItem key={value} value={value}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {ORDERING_INFO[section.itemOrdering]?.description}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Items Per Page</Label>
          <Input
            type="number"
            min={1}
            value={section.itemsPerPage ?? ""}
            onChange={(e) =>
              onChange({
                itemsPerPage: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="All on one page"
            className="h-9 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank to show all items on one scrollable page.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Time Limit (seconds)</Label>
          <Input
            type="number"
            min={1}
            value={section.timeLimitSeconds ?? ""}
            onChange={(e) =>
              onChange({
                timeLimitSeconds: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="No time limit"
            className="h-9 text-sm"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <Label className="text-xs">Allow Back Navigation</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Can candidates go back within this section?
            </p>
          </div>
          <Switch
            checked={section.allowBackNav}
            onCheckedChange={(v) => onChange({ allowBackNav: v })}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionsMatchGroups(sections: SectionDraft[], groups: FormatGroup[]): boolean {
  if (sections.length !== groups.length) return false
  const sectionFormats = new Set(sections.map((s) => s.responseFormatId))
  return groups.every((g) => sectionFormats.has(g.responseFormatId))
}
