'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  GripVertical,
  Plus,
  Trash2,
  Save,
  Eye,
  ChevronLeft,
  Settings,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { randomId } from '@/lib/ids'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TemplateBandSchemeSection } from './template-band-scheme-section'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { getSelectLabel } from '@/lib/select-display'
import { cn } from '@/lib/utils'
import { BLOCK_REGISTRY, isDeferredBlockType } from '@/lib/reports/registry'
import type { BlockType, BlockConfig, ResolvedBlockData } from '@/lib/reports/types'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { PageMapContext, measurePageUnits } from '@/components/reports/page-map'
import { computePageMap, A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX, type PageMap } from '@/lib/reports/pagination'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'
import { DEFAULT_3_BAND_SCHEME, type BandScheme } from '@/lib/reports/band-scheme'
import {
  updateReportTemplateBlocks,
  updateReportTemplateSettings,
  getEntityOptions,
  listAssessmentsForPreview,
  getPreviewEntitiesForAssessment,
  addCampaignTemplate,
  removeCampaignTemplate,
  type EntityOption,
  type TemplateUsageEntry,
  type PreviewAssessmentOption,
} from '@/app/actions/reports'
import type { PreviewEntity } from '@/lib/reports/sample-data'
import { useAutoSave } from '@/hooks/use-auto-save'
import { AutoSaveIndicator } from '@/components/auto-save-indicator'
import { AddBlockGallery } from './add-block-gallery'
import { BlockContentPanel } from './block-content-panels'
import { BlockHeadersPanel } from './block-headers-panel'
import { BlockPresentationPanel } from './block-presentation-panel'
import { BlockPrintPanel } from './block-print-panel'
import { DefaultToggle } from '../../default-toggle'
import type { ReportDisplayLevel, PersonReferenceType } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportType = 'self_report' | '360'

const reportTypeOptions = [
  { value: 'self_report', label: 'Self-report' },
  { value: '360', label: '360' },
] as const

const reportDisplayLevelOptions = [
  { value: 'dimension', label: 'Dimension' },
  { value: 'factor', label: 'Factor' },
] as const

const personReferenceOptions = [
  { value: 'you', label: 'You' },
  { value: 'first_name', label: 'First name' },
  { value: 'participant', label: 'Participant' },
  { value: 'the_participant', label: 'The participant' },
  { value: 'neutral', label: 'Neutral' },
] as const

const pageHeaderLogoOptions = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'none', label: 'None' },
] as const

export type PromptOption = { id: string; name: string; purpose: string }

export interface TemplateSettings {
  description?: string
  displayLevel: ReportDisplayLevel
  groupByDimension: boolean
  personReference: PersonReferenceType
  pageHeaderLogo: 'primary' | 'secondary' | 'none'
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  templateId: string
  templateName: string
  reportType: ReportType
  initialBlocks: BlockConfig[]
  initialUsage?: TemplateUsageEntry[]
  campaigns?: { id: string; title: string }[]
  templateSettings: TemplateSettings
  initialIsDefault?: boolean
  promptOptions?: PromptOption[]
  basePath?: string
}

function generateId(): string {
  return randomId()
}

// ---------------------------------------------------------------------------
// Block summary helper
// ---------------------------------------------------------------------------

function getBlockSummary(
  block: BlockConfig,
  entityOptions: EntityOption[],
  promptOptions: PromptOption[],
): string {
  const config = block.config as Record<string, unknown>

  function resolveEntityNames(ids: unknown): string {
    if (!Array.isArray(ids) || ids.length === 0) return 'All entities'
    const names = ids
      .map((id) => entityOptions.find((o) => o.id === id)?.label)
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : `${ids.length} entities`
  }

  switch (block.type) {
    case 'cover_page': {
      const parts: string[] = []
      if (config.showDate !== false) parts.push('Date')
      if (config.showPrimaryLogo !== false) parts.push('Logo')
      return parts.length > 0 ? parts.join(' \u00b7 ') : 'Cover page'
    }
    case 'custom_text': {
      const content = String(config.content ?? '')
      return content
        ? content.slice(0, 60) + (content.length > 60 ? '\u2026' : '')
        : 'Empty text block'
    }
    case 'section_divider': {
      const styleLabels: Record<string, string> = {
        thin_rule: 'Thin rule',
        thick_rule: 'Thick accent rule',
        whitespace: 'Whitespace',
        dot_break: 'Dot break',
      }
      return styleLabels[String(config.style)] ?? 'Divider'
    }
    case 'score_overview': {
      const chartLabel = block.chartType ?? config.chartType ?? 'chart'
      const entityIds = Array.isArray(config.entityIds) ? config.entityIds : []
      return `${String(chartLabel).replace(/_/g, ' ')} \u00b7 ${entityIds.length || 'All'} entities`
    }
    case 'score_detail': {
      const toggleNames: string[] = []
      if (config.showScore) toggleNames.push('Score')
      if (config.showBandLabel) toggleNames.push('Band')
      if (config.showDefinition) toggleNames.push('Definition')
      if (config.showIndicators) toggleNames.push('Indicators')
      if (config.showDevelopment) toggleNames.push('Development')
      return toggleNames.length > 0
        ? toggleNames.join(' \u00b7 ')
        : resolveEntityNames(config.entityIds)
    }
    case 'dimension_chapter': {
      const depth = String(config.depth ?? 'standard')
      const dimensionIds = Array.isArray(config.dimensionIds) ? config.dimensionIds : []
      const scope = dimensionIds.length > 0 ? resolveEntityNames(dimensionIds) : 'All dimensions'
      return `${depth.charAt(0).toUpperCase()}${depth.slice(1)} depth · ${scope}`
    }
    case 'contents':
      return config.showBandLegend === false
        ? 'Auto-generated sections'
        : 'Auto-generated sections · Band legend'
    case 'closing_page':
      return 'Methodology · Bands · Confidentiality'
    case 'strengths_highlights':
      return `Top ${config.topN ?? 3} strengths`
    case 'development_plan': {
      let text = `${config.maxItems ?? 3} areas`
      if (config.prioritiseByScore) text += ' \u00b7 By score'
      return text
    }
    case 'ai_text': {
      const prompt = promptOptions.find((p) => p.id === config.promptId)
      return prompt ? prompt.name : 'No prompt selected'
    }
    case 'norm_comparison':
    case 'rater_comparison':
    case 'gap_analysis':
    case 'open_comments':
      return 'Coming soon'
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Inspector groups — collapsible sections replacing the old 4-tab layout
// ---------------------------------------------------------------------------

const BLOCKS_WITHOUT_HEADERS: BlockType[] = ['cover_page', 'section_divider']
const BLOCKS_WITHOUT_PRESENTATION: BlockType[] = ['section_divider']

function InspectorGroup({
  label,
  defaultOpen = false,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border/60 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function BlockBuilderClient({
  templateId,
  templateName: initialName,
  reportType,
  initialBlocks,
  initialUsage,
  campaigns: allCampaigns,
  templateSettings: initialSettings,
  initialIsDefault = false,
  promptOptions: initialPromptOptions = [],
  basePath = '/report-templates',
}: Props) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<BlockConfig[]>(initialBlocks)
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [name, setName] = useState(initialName)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isSaving, startSave] = useTransition()
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])
  const [usage, setUsage] = useState<TemplateUsageEntry[]>(initialUsage ?? [])
  const [isLinking, startLinking] = useTransition()
  const [promptOptions] = useState<PromptOption[]>(initialPromptOptions)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewScheme, setPreviewScheme] = useState<BandScheme>(DEFAULT_3_BAND_SCHEME)
  const [previewBlocks, setPreviewBlocks] = useState(() =>
    buildTemplatePreviewBlocks(initialBlocks, [], initialName, DEFAULT_3_BAND_SCHEME),
  )
  const [previewAssessments, setPreviewAssessments] = useState<PreviewAssessmentOption[]>([])
  const [selectedPreviewAssessmentId, setSelectedPreviewAssessmentId] = useState<string | null>(null)
  const [previewEntities, setPreviewEntities] = useState<PreviewEntity[]>([])

  // Template settings state
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [settings, setSettings] = useState<TemplateSettings>(initialSettings)
  const [settingsSaveState, setSettingsSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isSavingSettings, startSaveSettings] = useTransition()

  // Auto-save for description field
  const descriptionAutoSave = useAutoSave({
    initialValue: initialSettings.description ?? '',
    onSave: async (value) => {
      await updateReportTemplateSettings(templateId, { description: value })
    },
    enabled: true,
  })

  // Entity options list (for picker UI in block configs — unchanged)
  useEffect(() => {
    getEntityOptions().then(setEntityOptions)
  }, [])

  // Load assessment list once; default to last-used or first option.
  useEffect(() => {
    listAssessmentsForPreview().then((items) => {
      setPreviewAssessments(items)
      const saved = typeof window !== 'undefined'
        ? window.localStorage.getItem(`preview-assessment-${templateId}`)
        : null
      const initial = items.find((a) => a.id === saved) ?? items[0]
      if (initial) setSelectedPreviewAssessmentId(initial.id)
    })
  }, [templateId])

  // When the selected preview assessment changes, load its scoped entities + seeded scores.
  useEffect(() => {
    if (!selectedPreviewAssessmentId) return
    getPreviewEntitiesForAssessment(selectedPreviewAssessmentId).then((entities) => {
      setPreviewEntities(entities)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`preview-assessment-${templateId}`, selectedPreviewAssessmentId)
      }
    })
  }, [selectedPreviewAssessmentId, templateId])

  // Rebuild preview blocks when blocks, name, or preview entities change.
  useEffect(() => {
    const ordered = blocks.map((b, i) => ({ ...b, order: i }))
    const timeoutId = window.setTimeout(() => {
      setPreviewBlocks(buildTemplatePreviewBlocks(ordered, previewEntities, name, previewScheme))
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [blocks, previewEntities, name, previewScheme])

  // ---------------------------------------------------------------------------
  // Save blocks + name
  // ---------------------------------------------------------------------------
  function handleSave() {
    setSaveState('saving')
    startSave(async () => {
      try {
        const ordered = blocks.map((b, i) => ({ ...b, order: i }))
        await Promise.all([
          updateReportTemplateBlocks(templateId, ordered as unknown as Record<string, unknown>[]),
          name !== initialName
            ? updateReportTemplateSettings(templateId, { name })
            : Promise.resolve(),
        ])
        toast.success('Template saved')
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2000)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
        setSaveState('idle')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Save template settings (from sheet)
  // ---------------------------------------------------------------------------
  function handleSaveSettings() {
    setSettingsSaveState('saving')
    startSaveSettings(async () => {
      try {
        await updateReportTemplateSettings(templateId, {
          displayLevel: settings.displayLevel,
          personReference: settings.personReference,
          pageHeaderLogo: settings.pageHeaderLogo,
        })
        toast.success('Settings saved')
        setSettingsSaveState('saved')
        setTimeout(() => setSettingsSaveState('idle'), 2000)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
        setSettingsSaveState('idle')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Add block (at position or end)
  // ---------------------------------------------------------------------------
  function addBlock(type: BlockType, atIndex?: number) {
    if (isDeferredBlockType(type)) {
      toast.error('This block is not available yet.')
      return
    }

    const meta = BLOCK_REGISTRY[type]
    const newBlock: BlockConfig = {
      id: generateId(),
      type,
      order: blocks.length,
      config: { ...meta.defaultConfig } as BlockConfig['config'],
      presentationMode: meta.defaultMode,
      chartType: meta.supportedCharts?.[0],
    }
    setBlocks((prev) => {
      if (atIndex !== undefined) {
        const list = [...prev]
        list.splice(atIndex, 0, newBlock)
        return list
      }
      return [...prev, newBlock]
    })
    setExpandedBlockId(newBlock.id)
  }

  // ---------------------------------------------------------------------------
  // Remove block
  // ---------------------------------------------------------------------------
  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (expandedBlockId === id) setExpandedBlockId(null)
  }

  // ---------------------------------------------------------------------------
  // Toggle expand
  // ---------------------------------------------------------------------------
  function toggleExpand(id: string) {
    setExpandedBlockId((prev) => (prev === id ? null : id))
  }

  // Click-to-select from the preview: expand the matching block card and
  // bring it into view in the left column.
  const handlePreviewBlockSelect = useCallback((blockId: string) => {
    setExpandedBlockId(blockId)
    requestAnimationFrame(() => {
      document
        .getElementById(`builder-block-${blockId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Update selected block config
  // ---------------------------------------------------------------------------
  const updateConfig = useCallback((key: string, value: unknown) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === expandedBlockId
          ? { ...b, config: { ...b.config, [key]: value } }
          : b,
      ),
    )
  }, [expandedBlockId])

  const updateBlock = useCallback((updates: Partial<BlockConfig>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === expandedBlockId ? { ...b, ...updates } : b)),
    )
  }, [expandedBlockId])

  // ---------------------------------------------------------------------------
  // Drag to reorder
  // ---------------------------------------------------------------------------
  function handleDragStart(id: string) {
    setDraggingId(id)
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    setDragOverId(id)
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }
    setBlocks((prev) => {
      const list = [...prev]
      const fromIdx = list.findIndex((b) => b.id === draggingId)
      const toIdx = list.findIndex((b) => b.id === targetId)
      const [item] = list.splice(fromIdx, 1)
      list.splice(toIdx, 0, item)
      return list
    })
    setDraggingId(null)
    setDragOverId(null)
  }

  // ---------------------------------------------------------------------------
  // Campaign link / unlink
  // ---------------------------------------------------------------------------
  function handleLinkCampaign(campaignId: string) {
    startLinking(async () => {
      try {
        await addCampaignTemplate(campaignId, templateId)
        const campaign = allCampaigns?.find((c) => c.id === campaignId)
        setUsage((prev) => [
          ...prev,
          { campaignId, campaignTitle: campaign?.title ?? 'Campaign' },
        ])
        toast.success('Template linked to campaign')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Link failed')
      }
    })
  }

  function handleUnlinkCampaign(campaignId: string) {
    startLinking(async () => {
      try {
        await removeCampaignTemplate(campaignId, templateId)
        setUsage((prev) =>
          prev.filter((u) => u.campaignId !== campaignId),
        )
        toast.success('Template unlinked from campaign')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Unlink failed')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Save button label
  // ---------------------------------------------------------------------------
  const saveLabel = saveState === 'saving' ? 'Saving\u2026' : saveState === 'saved' ? 'Saved' : 'Save'
  const settingsSaveLabel = settingsSaveState === 'saving' ? 'Saving\u2026' : settingsSaveState === 'saved' ? 'Saved' : 'Save Settings'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push(basePath)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-56 text-sm font-semibold border border-transparent hover:border-border focus-visible:border-primary rounded-md px-2 transition-colors"
        />
        <Select
          value={reportType}
          onValueChange={(v) => {
            if (v) {
              startSave(async () => {
                try {
                  await updateReportTemplateSettings(templateId, { reportType: v as ReportType })
                  toast.success('Report type updated')
                  router.refresh()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Update failed')
                }
              })
            }
          }}
        >
          <SelectTrigger className="h-7 w-auto text-xs border-dashed gap-1">
            <SelectValue>
              {(value: string | null) =>
                getSelectLabel(value as ReportType | null, reportTypeOptions)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self_report">Self-report</SelectItem>
            <SelectItem value="360">360</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <AddBlockGallery reportType={reportType} onAdd={(type) => addBlock(type)} />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || saveState === 'saved'}
          >
            <Save className="size-3.5" />
            {saveLabel}
          </Button>
        </div>
      </div>

      <div className={cn('flex-1 overflow-hidden', !reviewMode && 'lg:grid lg:grid-cols-2')}>
        <div className={cn('overflow-y-auto bg-background p-6', reviewMode && 'hidden')}>
          <div className="mx-auto max-w-3xl space-y-6">
            <InlineTemplateSettingsPanel
              expanded={settingsExpanded}
              onExpandedChange={setSettingsExpanded}
              descriptionAutoSave={descriptionAutoSave}
              settings={settings}
              onChangeSettings={setSettings}
              onSaveSettings={handleSaveSettings}
              isSavingSettings={isSavingSettings}
              disableSaveSettings={settingsSaveState === 'saved'}
              settingsSaveLabel={settingsSaveLabel}
              usage={usage}
              campaigns={allCampaigns}
              isLinking={isLinking}
              onLink={handleLinkCampaign}
              onUnlink={handleUnlinkCampaign}
              templateId={templateId}
              initialIsDefault={initialIsDefault}
              onSchemeChange={setPreviewScheme}
            />

            {blocks.length === 0 ? (
              <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card/60">
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No blocks yet. Add your first block to get started.
                  </p>
                  <AddBlockGallery reportType={reportType} onAdd={(type) => addBlock(type)} />
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {blocks.map((block, index) => {
                  const meta = BLOCK_REGISTRY[block.type]
                  const isDeferredBlock = isDeferredBlockType(block.type)
                  const isExpanded = expandedBlockId === block.id
                  const summary = getBlockSummary(block, entityOptions, promptOptions)

                  return (
                    <div key={block.id}>
                      <InlineAddButton
                        reportType={reportType}
                        onAdd={(type) => addBlock(type, index)}
                      />

                      <div
                        id={`builder-block-${block.id}`}
                        draggable={!isExpanded}
                        onDragStart={() => handleDragStart(block.id)}
                        onDragOver={(e) => handleDragOver(e, block.id)}
                        onDrop={() => handleDrop(block.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                        className={cn(
                          'group rounded-xl border bg-card transition-all',
                          isExpanded
                            ? 'border-primary shadow-sm'
                            : 'border-border hover:border-primary/40',
                          dragOverId === block.id && draggingId !== block.id
                            ? 'border-primary/60 bg-primary/5'
                            : '',
                          draggingId === block.id ? 'opacity-50' : '',
                        )}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          className="flex cursor-pointer items-center gap-3 rounded-t-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          onClick={() => toggleExpand(block.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleExpand(block.id);
                            }
                          }}
                        >
                          <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" />
                          <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground/50">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{meta.label}</p>
                              {isDeferredBlock && (
                                <Badge className="border-amber-500/30 bg-amber-500/[0.08] text-amber-800">
                                  Coming soon
                                </Badge>
                              )}
                              <ModeTag mode={block.presentationMode ?? meta.defaultMode} />
                              {block.chartType && meta.supportedCharts && (
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {block.chartType.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {summary}
                            </p>
                          </div>
                          {block.printBreakBefore && (
                            <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                              Page break
                            </Badge>
                          )}
                          <button
                            type="button"
                            aria-label="Delete block"
                            onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="shrink-0 rounded opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Trash2 className="size-4 text-muted-foreground transition-colors hover:text-destructive" />
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border">
                            {isDeferredBlock && (
                              <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-800">
                                Coming soon — this block stays hidden from participants until its data pipeline is implemented.
                              </div>
                            )}

                            <div className="px-4 pb-1">
                              <InspectorGroup label="Content" defaultOpen>
                                <BlockContentPanel
                                  block={block}
                                  entityOptions={entityOptions}
                                  promptOptions={promptOptions}
                                  onUpdateConfig={updateConfig}
                                />
                              </InspectorGroup>
                              {!BLOCKS_WITHOUT_HEADERS.includes(block.type) && (
                                <InspectorGroup label="Header">
                                  <BlockHeadersPanel block={block} onUpdateBlock={updateBlock} />
                                </InspectorGroup>
                              )}
                              {!BLOCKS_WITHOUT_PRESENTATION.includes(block.type) && (
                                <InspectorGroup label="Style">
                                  <BlockPresentationPanel block={block} onUpdateBlock={updateBlock} />
                                </InspectorGroup>
                              )}
                              <InspectorGroup label="Print & visibility">
                                <BlockPrintPanel block={block} onUpdateBlock={updateBlock} />
                              </InspectorGroup>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                <InlineAddButton
                  reportType={reportType}
                  onAdd={(type) => addBlock(type, blocks.length)}
                />
              </div>
            )}
          </div>
        </div>

        <div className={cn('hidden min-h-0 flex-col bg-muted/15 lg:flex', !reviewMode && 'border-l border-border', reviewMode && 'h-full')}>
          <TemplatePreviewSurface
            templateId={templateId}
            basePath={basePath}
            blocks={previewBlocks}
            assessments={previewAssessments}
            selectedAssessmentId={selectedPreviewAssessmentId}
            onSelectAssessment={setSelectedPreviewAssessmentId}
            onBlockSelect={handlePreviewBlockSelect}
            selectedBlockId={expandedBlockId}
            reviewMode={reviewMode}
            onToggleReview={() => setReviewMode((v) => !v)}
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="fixed right-6 bottom-6 z-20 shadow-lg lg:hidden"
        onClick={() => setPreviewOpen(true)}
      >
        <Eye className="size-3.5" />
        Preview
      </Button>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Live Preview</SheetTitle>
            <SheetDescription>
              Sample data refreshes about 500ms after you change the builder.
            </SheetDescription>
          </SheetHeader>
          <TemplatePreviewSurface
            templateId={templateId}
            basePath={basePath}
            blocks={previewBlocks}
            assessments={previewAssessments}
            selectedAssessmentId={selectedPreviewAssessmentId}
            onSelectAssessment={setSelectedPreviewAssessmentId}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ModeTag — small coloured badge for presentation mode
// ---------------------------------------------------------------------------

const MODE_COLORS: Record<string, string> = {
  featured: 'bg-emerald-800 text-white',
  open: 'bg-gray-200 text-gray-600',
  carded: 'bg-amber-600 text-white',
  split: 'bg-violet-600 text-white',
  inset: 'bg-rose-500 text-white',
}

function ModeTag({ mode }: { mode: string }) {
  return (
    <span className={cn(
      'inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
      MODE_COLORS[mode] ?? 'bg-gray-200 text-gray-600',
    )}>
      {mode}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inline template settings
// ---------------------------------------------------------------------------

interface InlineTemplateSettingsPanelProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  descriptionAutoSave: ReturnType<typeof useAutoSave>
  settings: TemplateSettings
  onChangeSettings: React.Dispatch<React.SetStateAction<TemplateSettings>>
  onSaveSettings: () => void
  isSavingSettings: boolean
  disableSaveSettings: boolean
  settingsSaveLabel: string
  usage: TemplateUsageEntry[]
  campaigns?: { id: string; title: string }[]
  isLinking: boolean
  onLink: (campaignId: string) => void
  onUnlink: (campaignId: string) => void
  templateId: string
  initialIsDefault: boolean
  onSchemeChange: (scheme: BandScheme) => void
}

function InlineTemplateSettingsPanel({
  expanded,
  onExpandedChange,
  descriptionAutoSave,
  settings,
  onChangeSettings,
  onSaveSettings,
  isSavingSettings,
  disableSaveSettings,
  settingsSaveLabel,
  usage,
  campaigns,
  isLinking,
  onLink,
  onUnlink,
  templateId,
  initialIsDefault,
  onSchemeChange,
}: InlineTemplateSettingsPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Template Settings</p>
            <p className="text-xs text-muted-foreground">
              Description, display defaults, person reference, and campaign links.
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-6 border-t border-border px-4 py-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Default report</Label>
              <p className="text-xs text-muted-foreground">
                When on, this template auto-attaches to every campaign across the
                platform — existing and new. Turning it on now will link it to all
                current campaigns.
              </p>
            </div>
            <DefaultToggle templateId={templateId} isDefault={initialIsDefault} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Description</Label>
            <Textarea
              value={descriptionAutoSave.value}
              onChange={descriptionAutoSave.handleChange}
              onBlur={descriptionAutoSave.handleBlur}
              className="min-h-20 resize-y text-sm"
              placeholder="Brief description of this template…"
            />
            <AutoSaveIndicator
              status={descriptionAutoSave.status}
              onRetry={descriptionAutoSave.retry}
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Display Level</Label>
              <Select
                value={settings.displayLevel}
                onValueChange={(value) =>
                  onChangeSettings((current) => ({
                    ...current,
                    displayLevel: value as ReportDisplayLevel,
                  }))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(
                        value as ReportDisplayLevel | null,
                        reportDisplayLevelOptions,
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dimension">Dimension</SelectItem>
                  <SelectItem value="factor">Factor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Which taxonomy level is the primary unit across score blocks.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Person Reference</Label>
              <Select
                value={settings.personReference}
                onValueChange={(value) =>
                  onChangeSettings((current) => ({
                    ...current,
                    personReference: value as PersonReferenceType,
                  }))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(
                        value as PersonReferenceType | null,
                        personReferenceOptions,
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="you">You</SelectItem>
                  <SelectItem value="first_name">First name</SelectItem>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="the_participant">The participant</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How the report refers to the participant in narrative text.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Page Header Logo</Label>
            <Select
              value={settings.pageHeaderLogo}
              onValueChange={(value) =>
                onChangeSettings((current) => ({
                  ...current,
                  pageHeaderLogo: value as 'primary' | 'secondary' | 'none',
                }))
              }
            >
              <SelectTrigger className="h-8 w-full text-sm md:max-w-xs">
                <SelectValue>
                  {(value: string | null) =>
                    getSelectLabel(
                      value as typeof pageHeaderLogoOptions[number]['value'] | null,
                      pageHeaderLogoOptions,
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Logo shown in the header of each printed page.
            </p>
          </div>

          <Separator />
          <TemplateBandSchemeSection templateId={templateId} onSchemeChange={onSchemeChange} />
          {campaigns && (
            <>
              <Separator />
              <CampaignLinkagePanel
                usage={usage}
                campaigns={campaigns}
                isLinking={isLinking}
                onLink={onLink}
                onUnlink={onUnlink}
              />
            </>
          )}

          <div className="flex justify-end">
            <Button
              onClick={onSaveSettings}
              disabled={isSavingSettings || disableSaveSettings}
            >
              <Save className="size-3.5" />
              {settingsSaveLabel}
            </Button>
          </div>
        </div>
      )}
      {/* Always mount so the band scheme loads eagerly for the live preview */}
      {!expanded && (
        <div className="hidden">
          <TemplateBandSchemeSection templateId={templateId} onSchemeChange={onSchemeChange} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview surface
// ---------------------------------------------------------------------------

function TemplatePreviewSurface({
  templateId,
  basePath,
  blocks,
  assessments,
  selectedAssessmentId,
  onSelectAssessment,
  onBlockSelect,
  selectedBlockId,
  reviewMode = false,
  onToggleReview,
}: {
  templateId: string
  basePath: string
  blocks: ResolvedBlockData[]
  assessments: PreviewAssessmentOption[]
  selectedAssessmentId: string | null
  onSelectAssessment: (id: string) => void
  onBlockSelect?: (blockId: string) => void
  selectedBlockId?: string | null
  reviewMode?: boolean
  onToggleReview?: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const [pageMap, setPageMap] = useState<PageMap | null>(null)

  // Measured pagination pass: project the rendered preview onto A4 pages.
  // The preview paper is narrower than true A4, so the page height scales
  // with the paper width — breaks land where they will in the PDF (±).
  const recompute = useCallback(() => {
    const paper = paperRef.current
    if (!paper || paper.clientWidth === 0) return
    const pageHeight = paper.clientWidth * (A4_PAGE_HEIGHT_PX / A4_PAGE_WIDTH_PX)
    const units = measurePageUnits(paper)
    setPageMap(computePageMap(units, pageHeight, paper.scrollHeight))
  }, [])

  useEffect(() => {
    // Let the new blocks paint before measuring.
    const t = window.setTimeout(recompute, 150)
    return () => window.clearTimeout(t)
  }, [blocks, reviewMode, recompute])

  useEffect(() => {
    if (!paperRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => recompute())
    observer.observe(paperRef.current)
    return () => observer.disconnect()
  }, [recompute])

  const jumpToPage = useCallback((page: number) => {
    const scroll = scrollRef.current
    const paper = paperRef.current
    if (!scroll || !paper || !pageMap) return
    const offset = page <= 1 ? 0 : (pageMap.breakOffsets[page - 2] ?? 0)
    const paperTop =
      paper.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop
    scroll.scrollTo({ top: Math.max(0, paperTop + offset - 12), behavior: 'smooth' })
  }, [pageMap])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur">
        <div>
          <p className="text-sm font-semibold">{reviewMode ? 'Review' : 'Live Preview'}</p>
          <p className="text-xs text-muted-foreground">
            {reviewMode
              ? 'Full-width render with sample data.'
              : 'Click a block to edit it. Sample data refreshes after edits.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pageMap && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-mono text-[11px] font-medium tracking-wide text-primary">
              ≈ {pageMap.pageCount} {pageMap.pageCount === 1 ? 'PAGE' : 'PAGES'}
            </span>
          )}
          {pageMap && pageMap.pageCount > 1 && (
            <select
              value=""
              onChange={(e) => {
                const n = Number(e.target.value)
                if (n) jumpToPage(n)
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label="Jump to page"
            >
              <option value="">Page…</option>
              {Array.from({ length: pageMap.pageCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>Page {i + 1}</option>
              ))}
            </select>
          )}
          {assessments.length > 0 && (
            <select
              value={selectedAssessmentId ?? ''}
              onChange={(e) => onSelectAssessment(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label="Preview as assessment"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          )}
          {onToggleReview && (
            <Button
              variant={reviewMode ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleReview}
            >
              <Eye className="size-3.5" />
              {reviewMode ? 'Exit review' : 'Review'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const url = new URL(`${basePath}/${templateId}/preview`, window.location.origin)
              if (selectedAssessmentId) url.searchParams.set('assessment', selectedAssessmentId)
              window.open(url.toString(), '_blank')
            }}
          >
            <Eye className="size-3.5" />
            Full preview
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[var(--report-page-bg,#fafaf8)] p-4">
        {!reviewMode && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-900">
            Preview only — rendered with sample participant data.
          </div>
        )}
        {/* A4 proportions: the paper is the same width ratio the PDF will use */}
        <div
          ref={paperRef}
          className="relative mx-auto max-w-3xl overflow-hidden rounded-md border border-black/5 bg-white shadow-xl"
        >
          <PageMapContext.Provider value={pageMap}>
            <ReportRenderer
              blocks={blocks}
              onBlockSelect={reviewMode ? undefined : onBlockSelect}
              selectedBlockId={reviewMode ? undefined : selectedBlockId}
            />
          </PageMapContext.Provider>
          {/* Page-break indicators from the measured pagination pass */}
          {pageMap?.breakOffsets.map((y, i) => (
            <div key={`${i}-${Math.round(y)}`} className="pointer-events-none absolute inset-x-0 z-20" style={{ top: y }}>
              <div className="border-t border-dashed border-primary/40" />
              <span className="absolute right-2 -top-2.5 rounded-full border border-primary/30 bg-card px-1.5 font-mono text-[10px] leading-4 text-primary">
                {i + 2}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineAddButton — appears between block cards on hover
// ---------------------------------------------------------------------------

function InlineAddButton({
  reportType,
  onAdd,
}: {
  reportType: ReportType
  onAdd: (type: BlockType) => void
}) {
  return (
    <div className="group/add relative flex items-center justify-center py-1.5">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border/50 opacity-0 transition-opacity group-hover/add:opacity-100" />
      <div className="relative z-10 opacity-40 transition-opacity group-hover/add:opacity-100">
        <AddBlockGallery reportType={reportType} onAdd={onAdd} variant="inline" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Campaign Linkage Panel — moved into template settings sheet
// ---------------------------------------------------------------------------

interface CampaignLinkagePanelProps {
  usage: TemplateUsageEntry[]
  campaigns: { id: string; title: string }[]
  isLinking: boolean
  onLink: (campaignId: string) => void
  onUnlink: (campaignId: string) => void
}

function CampaignLinkagePanel({ usage, campaigns, isLinking, onLink, onUnlink }: CampaignLinkagePanelProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  const linkedCampaignIds = new Set(usage.map((u) => u.campaignId))
  const availableCampaigns = campaigns.filter((c) => !linkedCampaignIds.has(c.id))
  const filteredCampaigns = linkSearch.trim()
    ? availableCampaigns.filter((c) => c.title.toLowerCase().includes(linkSearch.toLowerCase()))
    : availableCampaigns

  function handleConfirmLink() {
    if (!selectedCampaignId) return
    onLink(selectedCampaignId)
    setSelectedCampaignId(null)
    setLinkOpen(false)
    setLinkSearch('')
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaigns</p>

      {usage.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not linked to any campaigns.</p>
      ) : (
        <div className="space-y-2">
          {usage.map((entry) => (
            <div
              key={entry.campaignId}
              className="rounded-lg border border-border bg-muted/30 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">{entry.campaignTitle}</p>
                <button
                  type="button"
                  disabled={isLinking}
                  onClick={() => onUnlink(entry.campaignId)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            />
          }
        >
          <Plus className="size-3" />
          Link to campaign
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search campaigns\u2026"
              value={linkSearch}
              onValueChange={setLinkSearch}
            />
            <CommandList className="max-h-40">
              <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">
                No campaigns available.
              </CommandEmpty>
              <CommandGroup>
                {filteredCampaigns.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={(v) => setSelectedCampaignId(v)}
                    data-checked={c.id === selectedCampaignId}
                  >
                    {c.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>

          {selectedCampaignId && (
            <Button size="sm" className="w-full" disabled={isLinking} onClick={handleConfirmLink}>
              Link
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
