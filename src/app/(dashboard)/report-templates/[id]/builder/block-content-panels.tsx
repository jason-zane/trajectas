'use client'

import { useState } from 'react'
import { X, ChevronsUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RichTextEditor } from '@/components/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { getSelectLabel } from '@/lib/select-display'
import { cn } from '@/lib/utils'
import type { BlockConfig, BlockType } from '@/lib/reports/types'
import type { EntityOption } from '@/app/actions/reports'
import type { PromptOption } from './block-builder-client'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BlockContentPanelProps {
  block: BlockConfig
  entityOptions: EntityOption[]
  promptOptions: PromptOption[]
  onUpdateConfig: (key: string, value: unknown) => void
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
          <SelectValue>
            {(selectedValue: string | null) =>
              getSelectLabel(selectedValue, [
                { value: 'dimension', label: 'Dimension' },
                { value: 'factor', label: 'Factor' },
                { value: 'construct', label: 'Construct' },
              ])
            }
          </SelectValue>
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
// EntityMultiSelect
// ---------------------------------------------------------------------------

function EntityMultiSelect({
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
              placeholder="Search entities\u2026"
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
// Cover Page
// ---------------------------------------------------------------------------

function CoverPageContent({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <SwitchField
        id="cover-showDate"
        label="Show date"
        help="Display assessment completion date on the cover"
        checked={config.showDate as boolean ?? true}
        onChange={(v) => onUpdateConfig('showDate', v)}
      />
      <SwitchField
        id="cover-showLogo"
        label="Show logo"
        help="Display the partner logo on the cover page"
        checked={config.showLogo as boolean ?? true}
        onChange={(v) => onUpdateConfig('showLogo', v)}
      />
      <SwitchField
        id="cover-showPoweredBy"
        label="Show powered by"
        help="Display a 'Powered by' attribution line"
        checked={config.showPoweredBy as boolean ?? false}
        onChange={(v) => onUpdateConfig('showPoweredBy', v)}
      />
      {config.showPoweredBy === true && (
        <Field label="Powered by text">
          <Input
            value={String(config.poweredByText ?? '')}
            onChange={(e) => onUpdateConfig('poweredByText', e.target.value)}
            className="h-8 text-sm"
            placeholder="Powered by Trajectas"
          />
        </Field>
      )}

      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title fields</p>
        <SwitchField
          id="cover-showAssessmentName"
          label="Show assessment name"
          help="The name of the assessment instrument"
          checked={config.showAssessmentName as boolean ?? true}
          onChange={(v) => onUpdateConfig('showAssessmentName', v)}
        />
        <SwitchField
          id="cover-showCampaignName"
          label="Show campaign name"
          help="The campaign this participant was part of"
          checked={config.showCampaignName as boolean ?? false}
          onChange={(v) => onUpdateConfig('showCampaignName', v)}
        />
        <SwitchField
          id="cover-showReportName"
          label="Show report name"
          help="The name of this report template"
          checked={config.showReportName as boolean ?? false}
          onChange={(v) => onUpdateConfig('showReportName', v)}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Text
// ---------------------------------------------------------------------------

function CustomTextContent({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Content">
        <RichTextEditor
          content={String(config.content ?? '')}
          onChange={(html) => onUpdateConfig('content', html)}
          placeholder="Write your content here\u2026"
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section Divider
// ---------------------------------------------------------------------------

const DIVIDER_STYLES = [
  { value: 'thin_rule', label: 'Thin rule' },
  { value: 'thick_rule', label: 'Thick rule' },
  { value: 'whitespace', label: 'Whitespace' },
  { value: 'dot_break', label: 'Dot break' },
] as const

function SectionDividerContent({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  const currentStyle = String(config.style ?? 'thin_rule')

  return (
    <div className="space-y-4">
      <Field label="Style">
        <div className="grid grid-cols-2 gap-2">
          {DIVIDER_STYLES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdateConfig('style', opt.value)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm text-left transition-colors',
                currentStyle === opt.value
                  ? 'border-primary bg-primary/5 text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Overview
// ---------------------------------------------------------------------------

function ScoreOverviewContent({ block, entityOptions, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  const entityIds = Array.isArray(config.entityIds) ? (config.entityIds as string[]) : []

  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <Field label="Entities" help="Leave empty to show all scored entities">
        <EntityMultiSelect
          value={entityIds}
          onChange={(ids) => onUpdateConfig('entityIds', ids)}
          options={entityOptions}
          emptyMessage="No entities selected — all scored entities at the selected level will be shown."
        />
      </Field>
      <SwitchField
        id="overview-showScore"
        label="Show score"
        help="Display the numeric score value"
        checked={config.showScore as boolean ?? true}
        onChange={(v) => onUpdateConfig('showScore', v)}
      />
      <SwitchField
        id="overview-showBandLabel"
        label="Show band label"
        help="Qualitative label like 'Highly Effective' or 'Developing'"
        checked={config.showBandLabel as boolean ?? true}
        onChange={(v) => onUpdateConfig('showBandLabel', v)}
      />
      <SwitchField
        id="overview-groupByDimension"
        label="Group by dimension"
        help="Group factors/constructs under their parent dimension heading"
        checked={config.groupByDimension as boolean ?? false}
        onChange={(v) => onUpdateConfig('groupByDimension', v)}
      />
      {block.chartType !== 'radar' && (
        <SwitchField
          id="overview-showAnchors"
          label="Show anchors"
          help="Display low/high anchor sentences beneath each score bar"
          checked={config.showAnchors as boolean ?? false}
          onChange={(v) => onUpdateConfig('showAnchors', v)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Interpretation
// ---------------------------------------------------------------------------

function ScoreInterpretationContent({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <SwitchField
        id="interp-groupByDimension"
        label="Group by dimension"
        help="Group factors/constructs under their parent dimension heading"
        checked={config.groupByDimension as boolean ?? true}
        onChange={(v) => onUpdateConfig('groupByDimension', v)}
      />
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display toggles</p>
        <SwitchField
          id="interp-showScore"
          label="Score"
          help="Display the numeric score value"
          checked={config.showScore as boolean ?? true}
          onChange={(v) => onUpdateConfig('showScore', v)}
        />
        <SwitchField
          id="interp-showBandLabel"
          label="Band label"
          help="Qualitative label like 'Highly Effective' or 'Developing'"
          checked={config.showBandLabel as boolean ?? true}
          onChange={(v) => onUpdateConfig('showBandLabel', v)}
        />
        <SwitchField
          id="interp-showAnchors"
          label="Anchors"
          help="Low/high anchor sentences beneath each score bar"
          checked={config.showAnchors as boolean ?? true}
          onChange={(v) => onUpdateConfig('showAnchors', v)}
        />
      </div>
      <div className="space-y-3 pt-4 border-t border-border/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group-level display</p>
        <p className="text-xs text-muted-foreground -mt-2">
          Show the dimension&apos;s own score, band, and anchors above each group. Applies only when &quot;Group by dimension&quot; is on.
        </p>
        <SwitchField
          id="interp-showGroupScore"
          label="Group score"
          help="Show the group entity's numeric score and score bar"
          checked={config.showGroupScore as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupScore', v)}
        />
        <SwitchField
          id="interp-showGroupBand"
          label="Group band label"
          help="Show the qualitative band label for the group entity"
          checked={config.showGroupBand as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupBand', v)}
        />
        <SwitchField
          id="interp-showGroupAnchors"
          label="Group anchors"
          help="Show low/high anchor sentences for the group entity"
          checked={config.showGroupAnchors as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupAnchors', v)}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Interpretation v2
// ---------------------------------------------------------------------------

function ScoreInterpretationV2Content({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <SwitchField
        id="interp2-groupByDimension"
        label="Group by dimension"
        help="Group factors/constructs under their parent dimension heading"
        checked={config.groupByDimension as boolean ?? true}
        onChange={(v) => onUpdateConfig('groupByDimension', v)}
      />
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Factor display</p>
        <SwitchField
          id="interp2-showScore"
          label="Score"
          help="Display the numeric score value"
          checked={config.showScore as boolean ?? true}
          onChange={(v) => onUpdateConfig('showScore', v)}
        />
        <SwitchField
          id="interp2-showBandLabel"
          label="Band label"
          help="Qualitative label like 'Highly Effective' or 'Developing'"
          checked={config.showBandLabel as boolean ?? true}
          onChange={(v) => onUpdateConfig('showBandLabel', v)}
        />
        <SwitchField
          id="interp2-showAnchorLow"
          label="Low anchor"
          help="Low-end behavioural indicator text"
          checked={config.showAnchorLow as boolean ?? true}
          onChange={(v) => onUpdateConfig('showAnchorLow', v)}
        />
        <SwitchField
          id="interp2-showAnchorHigh"
          label="High anchor"
          help="High-end behavioural indicator text"
          checked={config.showAnchorHigh as boolean ?? true}
          onChange={(v) => onUpdateConfig('showAnchorHigh', v)}
        />
      </div>
      <div className="space-y-3 pt-4 border-t border-border/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dimension display</p>
        <p className="text-xs text-muted-foreground -mt-2">
          Show the dimension&apos;s own score, band, and anchors above each group. Applies only when &quot;Group by dimension&quot; is on.
        </p>
        <SwitchField
          id="interp2-showGroupScore"
          label="Dimension score"
          help="Show the dimension's numeric score and bar"
          checked={config.showGroupScore as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupScore', v)}
        />
        <SwitchField
          id="interp2-showGroupBand"
          label="Dimension band label"
          help="Show the qualitative band label for the dimension"
          checked={config.showGroupBand as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupBand', v)}
        />
        <SwitchField
          id="interp2-showGroupAnchorLow"
          label="Dimension low anchor"
          help="Low-end behavioural indicator for the dimension"
          checked={config.showGroupAnchorLow as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupAnchorLow', v)}
        />
        <SwitchField
          id="interp2-showGroupAnchorHigh"
          label="Dimension high anchor"
          help="High-end behavioural indicator for the dimension"
          checked={config.showGroupAnchorHigh as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupAnchorHigh', v)}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Detail
// ---------------------------------------------------------------------------

function ScoreDetailContent({ block, entityOptions, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  const entityIds = Array.isArray(config.entityIds) ? (config.entityIds as string[]) : []

  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <Field label="Entities" help="Leave empty to show all scored entities">
        <EntityMultiSelect
          value={entityIds}
          onChange={(ids) => onUpdateConfig('entityIds', ids)}
          options={entityOptions}
          emptyMessage="No entities selected — all scored entities at the selected level will be shown."
        />
      </Field>

      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display toggles</p>
        <SwitchField
          id="detail-showScore"
          label="Score"
          help="Display the numeric score value"
          checked={config.showScore as boolean ?? true}
          onChange={(v) => onUpdateConfig('showScore', v)}
        />
        <SwitchField
          id="detail-showBandLabel"
          label="Band label"
          help="Qualitative label like 'Highly Effective' or 'Developing'"
          checked={config.showBandLabel as boolean ?? true}
          onChange={(v) => onUpdateConfig('showBandLabel', v)}
        />
        <SwitchField
          id="detail-showDefinition"
          label="Definition"
          help="The definition from the factor/construct/dimension library"
          checked={config.showDefinition as boolean ?? true}
          onChange={(v) => onUpdateConfig('showDefinition', v)}
        />
        <SwitchField
          id="detail-showDescription"
          label="Description"
          help="The description from the factor/construct/dimension library"
          checked={config.showDescription as boolean ?? false}
          onChange={(v) => onUpdateConfig('showDescription', v)}
        />
        <SwitchField
          id="detail-showIndicators"
          label="Indicators"
          help="Behavioural indicators from the library, based on the score band"
          checked={config.showIndicators as boolean ?? false}
          onChange={(v) => onUpdateConfig('showIndicators', v)}
        />
        <SwitchField
          id="detail-showDevelopment"
          label="Development"
          help="Development suggestions and action items"
          checked={config.showDevelopment as boolean ?? false}
          onChange={(v) => onUpdateConfig('showDevelopment', v)}
        />
        <SwitchField
          id="detail-showNestedScores"
          label="Nested scores"
          help="Show child entity scores underneath each parent"
          checked={config.showNestedScores as boolean ?? false}
          onChange={(v) => onUpdateConfig('showNestedScores', v)}
        />
        {config.showNestedScores === true && (
          <Field label="Nested section label" help="Header text above child entities">
            <Input
              value={String(config.nestedLabel ?? 'Factors')}
              onChange={(e) => onUpdateConfig('nestedLabel', e.target.value)}
              className="h-8 text-sm"
              placeholder="Factors"
            />
          </Field>
        )}
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Strengths Highlights
// ---------------------------------------------------------------------------

function StrengthsContent({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <Field label="Top N" help="Number of top-scoring entities to highlight (1-10)">
        <Input
          type="number"
          value={config.topN as number ?? 3}
          onChange={(e) => onUpdateConfig('topN', Math.min(10, Math.max(1, Number(e.target.value))))}
          className="h-8 text-sm w-24"
          min={1}
          max={10}
        />
      </Field>
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Development Plan
// ---------------------------------------------------------------------------

function DevelopmentContent({ block, entityOptions, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  const entityIds = Array.isArray(config.entityIds) ? (config.entityIds as string[]) : []

  return (
    <div className="space-y-4">
      <Field label="Max items" help="Maximum number of development areas to show (1-10)">
        <Input
          type="number"
          value={config.maxItems as number ?? 3}
          onChange={(e) => onUpdateConfig('maxItems', Math.min(10, Math.max(1, Number(e.target.value))))}
          className="h-8 text-sm w-24"
          min={1}
          max={10}
        />
      </Field>
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <SwitchField
        id="dev-prioritiseByScore"
        label="Prioritise by score"
        help="Order development areas by lowest score first"
        checked={config.prioritiseByScore as boolean ?? true}
        onChange={(v) => onUpdateConfig('prioritiseByScore', v)}
      />
      <Field label="Entity filter" help="Limit to specific entities, or leave empty for all">
        <EntityMultiSelect
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
// AI Text
// ---------------------------------------------------------------------------

function AiTextContent({ block, promptOptions, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>

  if (promptOptions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No prompt templates configured. Add them in AI Settings.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Field label="Prompt template" help="The AI prompt used to generate narrative text for this block">
        <Select
          value={String(config.promptId ?? '')}
          onValueChange={(v) => onUpdateConfig('promptId', v)}
        >
          <SelectTrigger className="w-full h-8 text-sm">
            <SelectValue placeholder="Select a prompt template\u2026">
              {(value: string | null) =>
                getSelectLabel(
                  value,
                  promptOptions.map((prompt) => ({
                    value: prompt.id,
                    label: prompt.name,
                  })),
                  "Select a prompt template..."
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {promptOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Coming soon stubs
// ---------------------------------------------------------------------------

function ComingSoonPanel() {
  return (
    <p className="text-sm text-muted-foreground italic">Coming soon</p>
  )
}

// ---------------------------------------------------------------------------
// Panel router
// ---------------------------------------------------------------------------

const CONTENT_PANELS: Record<BlockType, React.ComponentType<BlockContentPanelProps>> = {
  cover_page: CoverPageContent,
  custom_text: CustomTextContent,
  section_divider: SectionDividerContent,
  score_overview: ScoreOverviewContent,
  score_detail: ScoreDetailContent,
  score_interpretation: ScoreInterpretationContent,
  score_interpretation_v2: ScoreInterpretationV2Content,
  strengths_highlights: StrengthsContent,
  development_plan: DevelopmentContent,
  ai_text: AiTextContent,
  norm_comparison: ComingSoonPanel,
  rater_comparison: ComingSoonPanel,
  gap_analysis: ComingSoonPanel,
  open_comments: ComingSoonPanel,
}

export function BlockContentPanel({
  block,
  entityOptions,
  promptOptions,
  onUpdateConfig,
}: BlockContentPanelProps) {
  const Panel = CONTENT_PANELS[block.type]
  if (!Panel) return null
  return (
    <Panel
      block={block}
      entityOptions={entityOptions}
      promptOptions={promptOptions}
      onUpdateConfig={onUpdateConfig}
    />
  )
}
