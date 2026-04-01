'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BlockConfig, BlockType } from '@/lib/reports/types'
import type { EntityOption } from '@/app/actions/reports'

// ---------------------------------------------------------------------------
// Help text for config fields
// ---------------------------------------------------------------------------

const FIELD_HELP: Record<string, string> = {
  showScore: 'Display the numeric score value',
  showBandLabel: 'Qualitative label like "Highly Effective" or "Developing"',
  showDefinition: 'The entity definition text',
  showIndicators: 'Behavioural indicators for each score band',
  showDevelopment: 'Development suggestions and action items',
  showChildBreakdown: 'Show child entity scores underneath',
  aiNarrative: 'Generate AI-written narrative interpreting the scores',
  prioritiseByScore: 'Order development areas by lowest score first',
  groupByFactor: 'Group open comments under their associated factor',
  showDate: 'Display assessment completion date',
  showPrimaryLogo: 'Display the primary partner logo',
  showSecondaryLogo: 'Display the secondary partner logo',
  showPoweredBy: 'Display a "Powered by" line',
  showBlindSpots: 'Self-rated higher than others (overconfidence)',
  showHiddenStrengths: 'Self-rated lower than others (undervalued strengths)',
  showLogo: 'Display logo on the cover page',
}

// ---------------------------------------------------------------------------
// Shared field components
// ---------------------------------------------------------------------------

interface FieldProps {
  children: React.ReactNode
  label: string
  help?: string
}

function Field({ children, label, help }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

function SwitchField({
  label,
  help,
  checked,
  onChange,
  id,
}: {
  label: string
  help?: string
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
      {help && <p className="text-xs text-muted-foreground pl-0">{help}</p>}
    </div>
  )
}

function DisplayLevelSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label="Display Level" help="Which taxonomy level to show scores for">
      <Select value={value} onValueChange={(v) => { if (v) onChange(v) }}>
        <SelectTrigger className="w-full h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dimension">Dimension</SelectItem>
          <SelectItem value="factor">Factor</SelectItem>
          <SelectItem value="construct">Construct</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}

// ---------------------------------------------------------------------------
// EntityMultiSelect (inline version for panels)
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { X, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

function EntityMultiSelectPanel({
  value,
  onChange,
  options,
  emptyMessage,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  options: EntityOption[]
  emptyMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = value
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean) as EntityOption[]

  const available = options.filter((o) => !value.includes(o.id))
  const filtered = search.trim()
    ? available.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : available

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs"
            >
              {opt.label}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== opt.id))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {value.length === 0 && emptyMessage && (
        <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-left transition-colors',
                'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                open && 'ring-2 ring-primary/30',
              )}
            />
          }
        >
          <span className="text-muted-foreground">Add specific entities, or leave empty to show all</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 overflow-hidden" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search entities…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-60">
              <CommandEmpty className="py-4 text-sm text-center text-muted-foreground">
                No entities available.
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.id}
                    onSelect={(v) => {
                      onChange([...value, v])
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <span className="flex-1">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel props
// ---------------------------------------------------------------------------

interface PanelProps {
  block: BlockConfig
  entityOptions: EntityOption[]
  onUpdateConfig: (key: string, value: unknown) => void
}

// ---------------------------------------------------------------------------
// Cover Page Panel
// ---------------------------------------------------------------------------

function CoverPagePanel({ block, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Subtitle" help="Optional subtitle below the participant name">
        <Input
          value={String(config.subtitle ?? '')}
          onChange={(e) => onUpdateConfig('subtitle', e.target.value || null)}
          className="h-8 text-sm"
          placeholder="e.g. Leadership Assessment 2026"
        />
      </Field>
      <SwitchField
        id="cover-showDate"
        label="Show date"
        help={FIELD_HELP.showDate}
        checked={config.showDate as boolean ?? true}
        onChange={(v) => onUpdateConfig('showDate', v)}
      />
      <SwitchField
        id="cover-showPrimaryLogo"
        label="Primary logo"
        help={FIELD_HELP.showPrimaryLogo}
        checked={config.showPrimaryLogo as boolean ?? true}
        onChange={(v) => onUpdateConfig('showPrimaryLogo', v)}
      />
      <SwitchField
        id="cover-showSecondaryLogo"
        label="Secondary logo"
        help={FIELD_HELP.showSecondaryLogo}
        checked={config.showSecondaryLogo as boolean ?? false}
        onChange={(v) => onUpdateConfig('showSecondaryLogo', v)}
      />
      <SwitchField
        id="cover-showPoweredBy"
        label="Powered by"
        help={FIELD_HELP.showPoweredBy}
        checked={config.showPoweredBy as boolean ?? false}
        onChange={(v) => onUpdateConfig('showPoweredBy', v)}
      />
      {config.showPoweredBy === true && (
        <Field label="Powered by text">
          <Input
            value={String(config.poweredByText ?? '')}
            onChange={(e) => onUpdateConfig('poweredByText', e.target.value)}
            className="h-8 text-sm"
            placeholder="Powered by Talent Fit"
          />
        </Field>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Text Panel
// ---------------------------------------------------------------------------

function CustomTextPanel({ block, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Heading" help="Optional heading above the text block">
        <Input
          value={String(config.heading ?? '')}
          onChange={(e) => onUpdateConfig('heading', e.target.value)}
          className="h-8 text-sm"
          placeholder="Section heading"
        />
      </Field>
      <Field label="Content" help="Markdown supported">
        <Textarea
          value={String(config.content ?? '')}
          onChange={(e) => onUpdateConfig('content', e.target.value)}
          className="text-sm min-h-24 resize-y"
          placeholder="Write your content here…"
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section Divider Panel
// ---------------------------------------------------------------------------

function SectionDividerPanel({ block, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Title">
        <Input
          value={String(config.title ?? '')}
          onChange={(e) => onUpdateConfig('title', e.target.value)}
          className="h-8 text-sm"
          placeholder="Section Title"
        />
      </Field>
      <Field label="Subtitle" help="Optional subtitle below the divider">
        <Input
          value={String(config.subtitle ?? '')}
          onChange={(e) => onUpdateConfig('subtitle', e.target.value || undefined)}
          className="h-8 text-sm"
          placeholder="Optional subtitle"
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Overview Panel
// ---------------------------------------------------------------------------

function ScoreOverviewPanel({ block, entityOptions, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  const entityIds = Array.isArray(config.entityIds) ? (config.entityIds as string[]) : []
  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <Field label="Entities" help="Leave empty to show all scored entities">
        <EntityMultiSelectPanel
          value={entityIds}
          onChange={(ids) => onUpdateConfig('entityIds', ids)}
          options={entityOptions}
          emptyMessage="No entities selected — this block will show all scored entities at the selected display level."
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Detail Panel
// ---------------------------------------------------------------------------

function ScoreDetailPanel({ block, entityOptions, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  const entityIds = Array.isArray(config.entityIds) ? (config.entityIds as string[]) : []
  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <Field label="Entities">
        <EntityMultiSelectPanel
          value={entityIds}
          onChange={(ids) => onUpdateConfig('entityIds', ids)}
          options={entityOptions}
          emptyMessage="No entities selected — this block will show all scored entities at the selected display level."
        />
      </Field>
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</p>
        <SwitchField
          id="detail-showScore"
          label="Score"
          help={FIELD_HELP.showScore}
          checked={config.showScore as boolean ?? true}
          onChange={(v) => onUpdateConfig('showScore', v)}
        />
        <SwitchField
          id="detail-showBandLabel"
          label="Band label"
          help={FIELD_HELP.showBandLabel}
          checked={config.showBandLabel as boolean ?? true}
          onChange={(v) => onUpdateConfig('showBandLabel', v)}
        />
        <SwitchField
          id="detail-showDefinition"
          label="Definition"
          help={FIELD_HELP.showDefinition}
          checked={config.showDefinition as boolean ?? true}
          onChange={(v) => onUpdateConfig('showDefinition', v)}
        />
        <SwitchField
          id="detail-showIndicators"
          label="Indicators"
          help={FIELD_HELP.showIndicators}
          checked={config.showIndicators as boolean ?? false}
          onChange={(v) => onUpdateConfig('showIndicators', v)}
        />
        <SwitchField
          id="detail-showDevelopment"
          label="Development"
          help={FIELD_HELP.showDevelopment}
          checked={config.showDevelopment as boolean ?? false}
          onChange={(v) => onUpdateConfig('showDevelopment', v)}
        />
        <SwitchField
          id="detail-showChildBreakdown"
          label="Child breakdown"
          help={FIELD_HELP.showChildBreakdown}
          checked={config.showChildBreakdown as boolean ?? false}
          onChange={(v) => onUpdateConfig('showChildBreakdown', v)}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Strengths Highlights Panel
// ---------------------------------------------------------------------------

function StrengthsHighlightsPanel({ block, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Show top" help="Number of top-scoring entities to highlight">
        <Input
          type="number"
          value={config.topN as number ?? 3}
          onChange={(e) => onUpdateConfig('topN', Number(e.target.value))}
          className="h-8 text-sm w-24"
          min={1}
          max={10}
        />
      </Field>
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <Field label="Style">
        <Select
          value={String(config.style ?? 'cards')}
          onValueChange={(v) => onUpdateConfig('style', v)}
        >
          <SelectTrigger className="w-full h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cards">Cards</SelectItem>
            <SelectItem value="list">List</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <SwitchField
        id="strengths-aiNarrative"
        label="AI narrative"
        help={FIELD_HELP.aiNarrative}
        checked={config.aiNarrative as boolean ?? false}
        onChange={(v) => onUpdateConfig('aiNarrative', v)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Development Plan Panel
// ---------------------------------------------------------------------------

function DevelopmentPlanPanel({ block, entityOptions, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  const entityIds = Array.isArray(config.entityIds) ? (config.entityIds as string[]) : []
  return (
    <div className="space-y-4">
      <Field label="Max items" help="Maximum number of development areas to show">
        <Input
          type="number"
          value={config.maxItems as number ?? 3}
          onChange={(e) => onUpdateConfig('maxItems', Number(e.target.value))}
          className="h-8 text-sm w-24"
          min={1}
          max={10}
        />
      </Field>
      <SwitchField
        id="dev-prioritiseByScore"
        label="Prioritise by score"
        help={FIELD_HELP.prioritiseByScore}
        checked={config.prioritiseByScore as boolean ?? true}
        onChange={(v) => onUpdateConfig('prioritiseByScore', v)}
      />
      <Field label="Entity filter" help="Limit to specific entities, or leave empty for all">
        <EntityMultiSelectPanel
          value={entityIds}
          onChange={(ids) => onUpdateConfig('entityIds', ids)}
          options={entityOptions}
          emptyMessage="All scored entities included."
        />
      </Field>
      <SwitchField
        id="dev-aiNarrative"
        label="AI narrative"
        help={FIELD_HELP.aiNarrative}
        checked={config.aiNarrative as boolean ?? false}
        onChange={(v) => onUpdateConfig('aiNarrative', v)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rater Comparison Panel
// ---------------------------------------------------------------------------

const RATER_GROUPS = ['self', 'manager', 'peers', 'direct_reports'] as const
const RATER_GROUP_LABELS: Record<string, string> = {
  self: 'Self',
  manager: 'Manager',
  peers: 'Peers',
  direct_reports: 'Direct Reports',
}

function RaterComparisonPanel({ block, entityOptions, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  const raterGroups = Array.isArray(config.raterGroups) ? (config.raterGroups as string[]) : []
  const entityIds = Array.isArray(config.entityIds) ? (config.entityIds as string[]) : []
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rater groups</p>
        {RATER_GROUPS.map((group) => (
          <SwitchField
            key={group}
            id={`rater-${group}`}
            label={RATER_GROUP_LABELS[group] ?? group}
            checked={raterGroups.includes(group)}
            onChange={(checked) => {
              const next = checked
                ? [...raterGroups, group]
                : raterGroups.filter((g) => g !== group)
              onUpdateConfig('raterGroups', next)
            }}
          />
        ))}
      </div>
      <Field label="Entities" help="Leave empty for all scored entities">
        <EntityMultiSelectPanel
          value={entityIds}
          onChange={(ids) => onUpdateConfig('entityIds', ids)}
          options={entityOptions}
          emptyMessage="All scored entities included."
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gap Analysis Panel
// ---------------------------------------------------------------------------

function GapAnalysisPanel({ block, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Gap threshold" help="Minimum POMP point difference to flag (default 20)">
        <Input
          type="number"
          value={config.gapThreshold as number ?? 20}
          onChange={(e) => onUpdateConfig('gapThreshold', Number(e.target.value))}
          className="h-8 text-sm w-24"
          min={5}
          max={50}
        />
      </Field>
      <SwitchField
        id="gap-showBlindSpots"
        label="Show blind spots"
        help={FIELD_HELP.showBlindSpots}
        checked={config.showBlindSpots as boolean ?? true}
        onChange={(v) => onUpdateConfig('showBlindSpots', v)}
      />
      <SwitchField
        id="gap-showHiddenStrengths"
        label="Show hidden strengths"
        help={FIELD_HELP.showHiddenStrengths}
        checked={config.showHiddenStrengths as boolean ?? true}
        onChange={(v) => onUpdateConfig('showHiddenStrengths', v)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Open Comments Panel
// ---------------------------------------------------------------------------

function OpenCommentsPanel({ block, onUpdateConfig }: PanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Min raters" help="Minimum number of raters required to display comments (anonymity floor)">
        <Input
          type="number"
          value={config.minRatersForDisplay as number ?? 3}
          onChange={(e) => onUpdateConfig('minRatersForDisplay', Number(e.target.value))}
          className="h-8 text-sm w-24"
          min={1}
          max={10}
        />
      </Field>
      <SwitchField
        id="comments-groupByFactor"
        label="Group by factor"
        help={FIELD_HELP.groupByFactor}
        checked={config.groupByFactor as boolean ?? true}
        onChange={(v) => onUpdateConfig('groupByFactor', v)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel router
// ---------------------------------------------------------------------------

const BLOCK_PANELS: Record<BlockType, React.ComponentType<PanelProps>> = {
  cover_page: CoverPagePanel,
  custom_text: CustomTextPanel,
  section_divider: SectionDividerPanel,
  score_overview: ScoreOverviewPanel,
  score_detail: ScoreDetailPanel,
  strengths_highlights: StrengthsHighlightsPanel,
  development_plan: DevelopmentPlanPanel,
  norm_comparison: () => (
    <p className="text-xs text-muted-foreground italic">
      Norm comparison is deferred — no configuration needed yet.
    </p>
  ),
  rater_comparison: RaterComparisonPanel,
  gap_analysis: GapAnalysisPanel,
  open_comments: OpenCommentsPanel,
}

export function BlockConfigContent({ block, entityOptions, onUpdateConfig }: PanelProps) {
  const Panel = BLOCK_PANELS[block.type]
  if (!Panel) return null
  return <Panel block={block} entityOptions={entityOptions} onUpdateConfig={onUpdateConfig} />
}

// ---------------------------------------------------------------------------
// Block summary helper
// ---------------------------------------------------------------------------

export function getBlockSummary(block: BlockConfig, entityOptions: EntityOption[]): string {
  const config = block.config as Record<string, unknown>

  function resolveEntityNames(ids: unknown): string {
    if (!Array.isArray(ids) || ids.length === 0) return 'All entities'
    const names = ids
      .map((id) => entityOptions.find((o) => o.id === id)?.label)
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : `${ids.length} entities`
  }

  switch (block.type) {
    case 'cover_page':
      return 'Cover page with participant name and date'
    case 'custom_text': {
      const content = String(config.content ?? '')
      return content ? content.slice(0, 60) + (content.length > 60 ? '…' : '') : 'Empty text block'
    }
    case 'section_divider':
      return String(config.title ?? 'Untitled section')
    case 'score_overview': {
      const chartLabel = block.chartType ?? config.chartType ?? 'chart'
      const entityIds = Array.isArray(config.entityIds) ? config.entityIds : []
      return `${String(chartLabel).replace(/_/g, ' ')} · ${entityIds.length || 'all'} entities`
    }
    case 'score_detail':
      return resolveEntityNames(config.entityIds)
    case 'strengths_highlights':
      return `Top ${config.topN ?? 3} strengths`
    case 'development_plan':
      return `${config.maxItems ?? 3} development areas`
    case 'norm_comparison':
      return 'Norm comparison (deferred)'
    case 'rater_comparison': {
      const groups = Array.isArray(config.raterGroups) ? config.raterGroups : []
      return groups.length > 0
        ? groups.map((g: string) => RATER_GROUP_LABELS[g] ?? g).join(', ')
        : '360 rater data'
    }
    case 'gap_analysis':
      return `Gap threshold: ${config.gapThreshold ?? 20} POMP`
    case 'open_comments':
      return `Min ${config.minRatersForDisplay ?? 3} raters · ${config.groupByFactor ? 'grouped by factor' : 'ungrouped'}`
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Config pills helper — returns active boolean toggle labels
// ---------------------------------------------------------------------------

const PILL_LABELS: Record<string, string> = {
  showScore: 'Score',
  showBandLabel: 'Band label',
  showDefinition: 'Definition',
  showIndicators: 'Indicators',
  showDevelopment: 'Development',
  showChildBreakdown: 'Child breakdown',
  aiNarrative: 'AI narrative',
  prioritiseByScore: 'By score',
  groupByFactor: 'By factor',
  showBlindSpots: 'Blind spots',
  showHiddenStrengths: 'Hidden strengths',
  showDate: 'Date',
  showPrimaryLogo: 'Logo',
  showPoweredBy: 'Powered by',
}

export function getConfigPills(block: BlockConfig): string[] {
  const config = block.config as Record<string, unknown>
  const pills: string[] = []
  for (const [key, label] of Object.entries(PILL_LABELS)) {
    if (config[key] === true) pills.push(label)
  }
  return pills
}

// ---------------------------------------------------------------------------
// Block type help text — shown in the sidebar when a block is expanded
// ---------------------------------------------------------------------------

export const BLOCK_HELP: Record<BlockType, { title: string; description: string; tips?: string }> = {
  cover_page: {
    title: 'Cover Page',
    description: 'The first page of the report. Shows the participant name, campaign title, and assessment date.',
    tips: 'Logos are sourced from the partner brand configuration. Enable the secondary logo for co-branded reports.',
  },
  custom_text: {
    title: 'Custom Text',
    description: 'A freeform text block authored by the administrator. Markdown formatting is supported.',
    tips: 'Use this for introductions, disclaimers, or contextual notes.',
  },
  section_divider: {
    title: 'Section Divider',
    description: 'A visual break that separates major sections of the report.',
  },
  score_overview: {
    title: 'Score Overview',
    description: 'A high-level chart showing all scored entities. Good as the first score block to give participants the big picture.',
    tips: 'Radar charts work well for 4–8 entities. Use bars for more than 8.',
  },
  score_detail: {
    title: 'Score Detail',
    description: 'Detailed view of individual entity scores with optional band labels, definitions, behavioural indicators, and development suggestions.',
    tips: 'Leave entity selection empty to auto-include all entities at the selected display level.',
  },
  strengths_highlights: {
    title: 'Strengths Highlights',
    description: 'Highlights the participant\'s top-scoring entities with visual emphasis.',
    tips: 'AI narrative generates a short, personalised interpretation of the strengths.',
  },
  development_plan: {
    title: 'Development Plan',
    description: 'Aggregates development suggestions from the lowest-scoring entities into an actionable plan.',
    tips: 'AI narrative creates a cohesive development story rather than a bullet list.',
  },
  norm_comparison: {
    title: 'Norm Comparison',
    description: 'Compares the participant\'s scores against a norm group. This block is deferred until norm groups are configured.',
  },
  rater_comparison: {
    title: 'Rater Comparison',
    description: 'Shows how different rater groups (self, manager, peers, direct reports) scored the participant on each entity.',
    tips: 'Enable only the rater groups relevant to your 360 design.',
  },
  gap_analysis: {
    title: 'Gap Analysis',
    description: 'Identifies blind spots (self overrating) and hidden strengths (self underrating) by comparing self-ratings with others.',
    tips: 'A lower gap threshold surfaces more items. The default of 20 POMP points is a reasonable starting point.',
  },
  open_comments: {
    title: 'Open Comments',
    description: 'Displays qualitative feedback from raters. An anonymity floor ensures comments are only shown when enough raters responded.',
    tips: 'The minimum rater threshold protects respondent anonymity.',
  },
}
