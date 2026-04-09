'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  SheetFooter,
} from '@/components/ui/sheet'
import { getSelectLabel } from '@/lib/select-display'
import { cn } from '@/lib/utils'
import { BLOCK_REGISTRY } from '@/lib/reports/registry'
import type { BlockType, BlockConfig } from '@/lib/reports/types'
import {
  updateReportTemplateBlocks,
  updateReportTemplateSettings,
  getEntityOptions,
  linkTemplateToCampaign,
  unlinkTemplateFromCampaign,
  type EntityOption,
  type TemplateUsageEntry,
  type AudienceType,
} from '@/app/actions/reports'
import { useAutoSave } from '@/hooks/use-auto-save'
import { AutoSaveIndicator } from '@/components/auto-save-indicator'
import { AddBlockDropdown } from './add-block-dropdown'
import { BlockContentPanel } from './block-content-panels'
import { BlockHeadersPanel } from './block-headers-panel'
import { BlockPresentationPanel } from './block-presentation-panel'
import { BlockPrintPanel } from './block-print-panel'
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
  { value: 'construct', label: 'Construct' },
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

const audienceTypeOptions = [
  { value: 'participant', label: 'Participant' },
  { value: 'hr_manager', label: 'HR / Manager' },
  { value: 'consultant', label: 'Consultant' },
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
// Audience type labels
// ---------------------------------------------------------------------------

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  participant: 'Participant',
  hr_manager: 'HR / Manager',
  consultant: 'Consultant',
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
  promptOptions?: PromptOption[]
}

function generateId(): string {
  return crypto.randomUUID()
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
// Tab types
// ---------------------------------------------------------------------------

type BlockTab = 'content' | 'headers' | 'presentation' | 'print'
const BLOCK_TABS: { id: BlockTab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'headers', label: 'Headers' },
  { id: 'presentation', label: 'Presentation' },
  { id: 'print', label: 'Print' },
]

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
  promptOptions: initialPromptOptions = [],
}: Props) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<BlockConfig[]>(initialBlocks)
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<BlockTab>('content')
  const [name, setName] = useState(initialName)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isSaving, startSave] = useTransition()
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])
  const [usage, setUsage] = useState<TemplateUsageEntry[]>(initialUsage ?? [])
  const [isLinking, startLinking] = useTransition()
  const [promptOptions] = useState<PromptOption[]>(initialPromptOptions)

  // Template settings state
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  useEffect(() => {
    getEntityOptions().then(setEntityOptions)
  }, [])

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
    setActiveTab('content')
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
    setExpandedBlockId((prev) => {
      if (prev === id) return null
      setActiveTab('content')
      return id
    })
  }

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
  function handleLinkCampaign(campaignId: string, audienceType: AudienceType) {
    startLinking(async () => {
      try {
        await linkTemplateToCampaign(templateId, campaignId, audienceType)
        const campaign = allCampaigns?.find((c) => c.id === campaignId)
        setUsage((prev) => [
          ...prev,
          { campaignId, campaignTitle: campaign?.title ?? 'Campaign', audienceType, assessments: [] },
        ])
        toast.success('Template linked to campaign')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Link failed')
      }
    })
  }

  function handleUnlinkCampaign(campaignId: string, audienceType: AudienceType) {
    startLinking(async () => {
      try {
        await unlinkTemplateFromCampaign(templateId, campaignId, audienceType)
        setUsage((prev) =>
          prev.filter((u) => !(u.campaignId === campaignId && u.audienceType === audienceType)),
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
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push('/report-templates')}
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
          <AddBlockDropdown reportType={reportType} onAdd={(type) => addBlock(type)} />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/report-templates/${templateId}/preview`, '_blank')}
          >
            <Eye className="size-3.5" />
            Preview
          </Button>
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

      {/* Full-width canvas */}
      <div className="flex-1 overflow-y-auto bg-background p-6">
        {blocks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No blocks yet. Add your first block to get started.
              </p>
              <AddBlockDropdown reportType={reportType} onAdd={(type) => addBlock(type)} />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-0">
            {blocks.map((block, index) => {
              const meta = BLOCK_REGISTRY[block.type]
              const isExpanded = expandedBlockId === block.id
              const summary = getBlockSummary(block, entityOptions, promptOptions)

              return (
                <div key={block.id}>
                  {/* Inline add button between blocks */}
                  <InlineAddButton
                    reportType={reportType}
                    onAdd={(type) => addBlock(type, index)}
                  />

                  {/* Block card */}
                  <div
                    draggable={!isExpanded}
                    onDragStart={() => handleDragStart(block.id)}
                    onDragOver={(e) => handleDragOver(e, block.id)}
                    onDrop={() => handleDrop(block.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                    className={cn(
                      'group rounded-xl border transition-all bg-card',
                      isExpanded
                        ? 'border-primary shadow-sm'
                        : 'border-border hover:border-primary/40',
                      dragOverId === block.id && draggingId !== block.id
                        ? 'border-primary/60 bg-primary/5'
                        : '',
                      draggingId === block.id ? 'opacity-50' : '',
                    )}
                  >
                    {/* Collapsed header — always visible */}
                    <div
                      className="flex cursor-pointer items-center gap-3 px-4 py-3"
                      onClick={() => toggleExpand(block.id)}
                    >
                      <GripVertical className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground/50 shrink-0 w-5 text-right">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{meta.label}</p>
                          <ModeTag mode={block.presentationMode ?? meta.defaultMode} />
                          {block.chartType && meta.supportedCharts && (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {block.chartType.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {summary}
                        </p>
                      </div>
                      {block.printBreakBefore && (
                        <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                          Page break
                        </Badge>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </div>

                    {/* Expanded block detail with tabs */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {/* Tab bar */}
                        <div className="flex gap-0 border-b border-border px-4">
                          {BLOCK_TABS.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={cn(
                                'px-3 py-2.5 text-sm font-medium transition-colors relative',
                                activeTab === tab.id
                                  ? 'text-foreground'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {tab.label}
                              {activeTab === tab.id && (
                                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary rounded-full" />
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Tab content */}
                        <div className="px-4 py-4">
                          {activeTab === 'content' && (
                            <BlockContentPanel
                              block={block}
                              entityOptions={entityOptions}
                              promptOptions={promptOptions}
                              onUpdateConfig={updateConfig}
                            />
                          )}
                          {activeTab === 'headers' && (
                            <BlockHeadersPanel block={block} onUpdateBlock={updateBlock} />
                          )}
                          {activeTab === 'presentation' && (
                            <BlockPresentationPanel block={block} onUpdateBlock={updateBlock} />
                          )}
                          {activeTab === 'print' && (
                            <BlockPrintPanel block={block} onUpdateBlock={updateBlock} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Trailing inline add button */}
            <InlineAddButton
              reportType={reportType}
              onAdd={(type) => addBlock(type, blocks.length)}
            />
          </div>
        )}
      </div>

      {/* Template Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Template Settings</SheetTitle>
            <SheetDescription>Configure template-level defaults that apply across all blocks.</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4">
            {/* Description — auto-save */}
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                value={descriptionAutoSave.value}
                onChange={descriptionAutoSave.handleChange}
                onBlur={descriptionAutoSave.handleBlur}
                className="text-sm min-h-20 resize-y"
                placeholder="Brief description of this template\u2026"
              />
              <AutoSaveIndicator status={descriptionAutoSave.status} onRetry={descriptionAutoSave.retry} />
            </div>

            <Separator />

            {/* Display Level */}
            <div className="space-y-1.5">
              <Label className="text-sm">Display Level</Label>
              <Select
                value={settings.displayLevel}
                onValueChange={(v) => setSettings((s) => ({ ...s, displayLevel: v as ReportDisplayLevel }))}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(
                        value as ReportDisplayLevel | null,
                        reportDisplayLevelOptions
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dimension">Dimension</SelectItem>
                  <SelectItem value="factor">Factor</SelectItem>
                  <SelectItem value="construct">Construct</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Which taxonomy level is the primary unit across score blocks</p>
            </div>

            {/* Person Reference */}
            <div className="space-y-1.5">
              <Label className="text-sm">Person Reference</Label>
              <Select
                value={settings.personReference}
                onValueChange={(v) => setSettings((s) => ({ ...s, personReference: v as PersonReferenceType }))}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(
                        value as PersonReferenceType | null,
                        personReferenceOptions
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
              <p className="text-xs text-muted-foreground">How the report refers to the participant in narrative text</p>
            </div>

            {/* Page Header Logo */}
            <div className="space-y-1.5">
              <Label className="text-sm">Page Header Logo</Label>
              <Select
                value={settings.pageHeaderLogo}
                onValueChange={(v) => setSettings((s) => ({ ...s, pageHeaderLogo: v as 'primary' | 'secondary' | 'none' }))}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(
                        value as typeof pageHeaderLogoOptions[number]["value"] | null,
                        pageHeaderLogoOptions
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
              <p className="text-xs text-muted-foreground">Logo in the header of each printed page</p>
            </div>

            <Separator />

            {/* Campaign Linkage */}
            {allCampaigns && (
              <CampaignLinkagePanel
                usage={usage}
                campaigns={allCampaigns}
                isLinking={isLinking}
                onLink={handleLinkCampaign}
                onUnlink={handleUnlinkCampaign}
              />
            )}
          </div>

          <SheetFooter>
            <Button
              onClick={handleSaveSettings}
              disabled={isSavingSettings || settingsSaveState === 'saved'}
              className="w-full"
            >
              <Save className="size-3.5" />
              {settingsSaveLabel}
            </Button>
          </SheetFooter>
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
  open: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
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
    <div className="relative flex items-center justify-center py-2">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border/50" />
      <div className="relative z-10">
        <AddBlockDropdown reportType={reportType} onAdd={onAdd} />
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
  onLink: (campaignId: string, audienceType: AudienceType) => void
  onUnlink: (campaignId: string, audienceType: AudienceType) => void
}

function CampaignLinkagePanel({ usage, campaigns, isLinking, onLink, onUnlink }: CampaignLinkagePanelProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedAudience, setSelectedAudience] = useState<AudienceType>('participant')

  const linkedCampaignIds = new Set(usage.map((u) => u.campaignId))
  const availableCampaigns = campaigns.filter((c) => !linkedCampaignIds.has(c.id))
  const filteredCampaigns = linkSearch.trim()
    ? availableCampaigns.filter((c) => c.title.toLowerCase().includes(linkSearch.toLowerCase()))
    : availableCampaigns

  function handleConfirmLink() {
    if (!selectedCampaignId) return
    onLink(selectedCampaignId, selectedAudience)
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
              key={`${entry.campaignId}-${entry.audienceType}`}
              className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">{entry.campaignTitle}</p>
                <button
                  type="button"
                  disabled={isLinking}
                  onClick={() => onUnlink(entry.campaignId, entry.audienceType)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {AUDIENCE_LABELS[entry.audienceType]}
              </Badge>
              {entry.assessments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {entry.assessments.map((a) => a.name).join(', ')}
                </p>
              )}
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
            <>
              <Select value={selectedAudience} onValueChange={(v) => setSelectedAudience(v as AudienceType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(value as AudienceType | null, audienceTypeOptions)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="hr_manager">HR / Manager</SelectItem>
                  <SelectItem value="consultant">Consultant</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" disabled={isLinking} onClick={handleConfirmLink}>
                Link
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
