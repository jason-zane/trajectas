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
  ChevronsUpDown,
  X,
  ChevronUp,
  ChevronDown,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { cn } from '@/lib/utils'
import {
  BLOCK_REGISTRY,
  BLOCK_CATEGORIES,
} from '@/lib/reports/registry'
import type { BlockType, BlockConfig } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
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
import {
  BlockConfigContent,
  getBlockSummary,
  getConfigPills,
  BLOCK_HELP,
} from './block-config-panels'

import type { ReportDisplayLevel, PersonReferenceType } from '@/types/database'

type ReportType = 'self_report' | '360'

// ---------------------------------------------------------------------------
// Template settings type (exported for page.tsx)
// ---------------------------------------------------------------------------

export interface TemplateSettings {
  description?: string
  displayLevel: ReportDisplayLevel
  groupByDimension: boolean
  personReference: PersonReferenceType
  autoRelease: boolean
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

interface Props {
  templateId: string
  templateName: string
  reportType: ReportType
  initialBlocks: BlockConfig[]
  initialUsage?: TemplateUsageEntry[]
  campaigns?: { id: string; title: string }[]
  templateSettings: TemplateSettings
}

function generateId(): string {
  return crypto.randomUUID()
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
}: Props) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<BlockConfig[]>(initialBlocks)
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [name, setName] = useState(initialName)
  const [isSaving, startSave] = useTransition()
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])
  const [usage, setUsage] = useState<TemplateUsageEntry[]>(initialUsage ?? [])
  const [isLinking, startLinking] = useTransition()

  // Template settings state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<TemplateSettings>(initialSettings)
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

  const expandedBlock = blocks.find((b) => b.id === expandedBlockId) ?? null

  // ---------------------------------------------------------------------------
  // Save blocks + name
  // ---------------------------------------------------------------------------
  function handleSave() {
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Save template settings (from sheet)
  // ---------------------------------------------------------------------------
  function handleSaveSettings() {
    startSaveSettings(async () => {
      try {
        await updateReportTemplateSettings(templateId, {
          displayLevel: settings.displayLevel,
          groupByDimension: settings.groupByDimension,
          personReference: settings.personReference,
          autoRelease: settings.autoRelease,
          pageHeaderLogo: settings.pageHeaderLogo,
        })
        toast.success('Settings saved')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Add block from palette
  // ---------------------------------------------------------------------------
  function addBlock(type: BlockType) {
    const meta = BLOCK_REGISTRY[type]
    const newBlock: BlockConfig = {
      id: generateId(),
      type,
      order: blocks.length,
      config: { ...meta.defaultConfig } as BlockConfig['config'],
      presentationMode: meta.defaultMode,
      chartType: meta.supportedCharts?.[0],
    }
    setBlocks((prev) => [...prev, newBlock])
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
  // Palette — group blocks by category, filter 360 if self_report template
  // ---------------------------------------------------------------------------
  const paletteCategories = Object.entries(BLOCK_CATEGORIES)
    .sort(([, a], [, b]) => a.order - b.order)
    .filter(([cat]) => reportType === '360' || cat !== '360')

  // ---------------------------------------------------------------------------
  // Toggle expand
  // ---------------------------------------------------------------------------
  function toggleExpand(id: string) {
    setExpandedBlockId((prev) => (prev === id ? null : id))
  }

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
          onClick={() => router.push('/settings/reports')}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-56 text-sm font-semibold bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
        />
        <Badge variant="outline" className="text-xs hidden sm:flex">
          {reportType === '360' ? '360' : 'Self-report'}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
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
            onClick={() => window.open(`/settings/reports/${templateId}/preview`, '_blank')}
          >
            <Eye className="size-3.5" />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="size-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Block palette */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-3 space-y-4">
          {paletteCategories.map(([cat, { label }]) => {
            const categoryBlocks = Object.entries(BLOCK_REGISTRY).filter(
              ([, meta]) => meta.category === cat,
            )
            if (categoryBlocks.length === 0) return null
            return (
              <div key={cat}>
                <p className="text-overline text-primary mb-1.5">{label}</p>
                <div className="space-y-1">
                  {categoryBlocks.map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => addBlock(type as BlockType)}
                      disabled={meta.isDeferred}
                      className={cn(
                        'w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        'hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed',
                        'flex items-start gap-2',
                      )}
                    >
                      <Plus className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium leading-snug">{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Centre: Canvas */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          {blocks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Add blocks from the panel on the left.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-2">
              {blocks.map((block) => {
                const meta = BLOCK_REGISTRY[block.type]
                const isExpanded = expandedBlockId === block.id
                const summary = getBlockSummary(block, entityOptions)
                const pills = getConfigPills(block)

                return (
                  <div
                    key={block.id}
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
                    {/* Card header — always visible */}
                    <div
                      className="flex cursor-pointer items-center gap-3 px-4 py-3"
                      onClick={() => toggleExpand(block.id)}
                    >
                      <GripVertical className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab shrink-0" />
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
                        {pills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {pills.map((pill) => (
                              <span
                                key={pill}
                                className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {pill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {block.printBreakBefore && (
                        <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">Page break</Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                    </div>

                    {/* Expanded inline detail */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left: Content config */}
                          <div className="space-y-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</p>
                            <BlockConfigContent
                              block={block}
                              entityOptions={entityOptions}
                              onUpdateConfig={updateConfig}
                            />
                          </div>

                          {/* Right: Presentation + Print */}
                          <div className="space-y-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Presentation</p>

                            {/* Mode selector */}
                            <div className="space-y-1.5">
                              <Label className="text-sm">Mode</Label>
                              <Select
                                value={block.presentationMode ?? meta.defaultMode}
                                onValueChange={(v) => updateBlock({ presentationMode: v as PresentationMode })}
                              >
                                <SelectTrigger className="w-full h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {meta.supportedModes.map((mode) => (
                                    <SelectItem key={mode} value={mode}>
                                      <span className="capitalize">{mode}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Columns (carded mode) */}
                            {(block.presentationMode ?? meta.defaultMode) === 'carded' && (
                              <div className="space-y-1.5">
                                <Label className="text-sm">Columns</Label>
                                <Select
                                  value={String(block.columns ?? 1)}
                                  onValueChange={(v) => updateBlock({ columns: Number(v) as 1 | 2 | 3 })}
                                >
                                  <SelectTrigger className="w-full h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 Column</SelectItem>
                                    <SelectItem value="2">2 Columns</SelectItem>
                                    <SelectItem value="3">3 Columns</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Chart type (single source of truth) */}
                            {meta.supportedCharts && meta.supportedCharts.length > 0 && (
                              <div className="space-y-1.5">
                                <Label className="text-sm">Chart Type</Label>
                                <Select
                                  value={block.chartType ?? meta.supportedCharts[0]}
                                  onValueChange={(v) => updateBlock({ chartType: v as ChartType })}
                                >
                                  <SelectTrigger className="w-full h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {meta.supportedCharts.map((ct) => (
                                      <SelectItem key={ct} value={ct}>
                                        <span className="capitalize">{ct.replace(/_/g, ' ')}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Inset accent */}
                            {(block.presentationMode ?? meta.defaultMode) === 'inset' && (
                              <div className="space-y-1.5">
                                <Label className="text-sm">Accent Colour</Label>
                                <Select
                                  value={block.insetAccent ?? 'default'}
                                  onValueChange={(v) => updateBlock({ insetAccent: v === 'default' ? undefined : v ?? undefined })}
                                >
                                  <SelectTrigger className="w-full h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="default">Default (Sage)</SelectItem>
                                    <SelectItem value="#c9a962">Gold</SelectItem>
                                    <SelectItem value="#5b3fc5">Violet</SelectItem>
                                    <SelectItem value="#b85c6a">Rose</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <Separator />

                            {/* Print options */}
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Print</p>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`print-break-${block.id}`} className="text-sm font-normal">Page break before</Label>
                                <Switch
                                  id={`print-break-${block.id}`}
                                  checked={block.printBreakBefore ?? false}
                                  onCheckedChange={(v) => updateBlock({ printBreakBefore: v })}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`print-hide-${block.id}`} className="text-sm font-normal">Hide in PDF</Label>
                                <Switch
                                  id={`print-hide-${block.id}`}
                                  checked={block.printHide ?? false}
                                  onCheckedChange={(v) => updateBlock({ printHide: v })}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`screen-hide-${block.id}`} className="text-sm font-normal">Hide on screen</Label>
                                <Switch
                                  id={`screen-hide-${block.id}`}
                                  checked={block.screenHide ?? false}
                                  onCheckedChange={(v) => updateBlock({ screenHide: v })}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Context panel */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-4 space-y-5">
          {/* Campaign linkage panel */}
          {allCampaigns && (
            <CampaignLinkagePanel
              usage={usage}
              campaigns={allCampaigns}
              isLinking={isLinking}
              onLink={handleLinkCampaign}
              onUnlink={handleUnlinkCampaign}
            />
          )}

          {expandedBlock ? (
            // Contextual help for the expanded block type
            <BlockHelpPanel blockType={expandedBlock.type} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-center py-8">
              <Settings className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Click a block to expand and configure it.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-3.5" />
                Template Settings
              </Button>
            </div>
          )}
        </div>
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
                placeholder="Brief description of this template…"
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dimension">Dimension</SelectItem>
                  <SelectItem value="factor">Factor</SelectItem>
                  <SelectItem value="construct">Construct</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Which taxonomy level is the primary unit across score blocks</p>
            </div>

            {/* Group by Dimension */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="settings-groupByDimension" className="text-sm font-normal">Group by dimension</Label>
                <Switch
                  id="settings-groupByDimension"
                  checked={settings.groupByDimension}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, groupByDimension: v }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Group factors under their parent dimension heading</p>
            </div>

            {/* Person Reference */}
            <div className="space-y-1.5">
              <Label className="text-sm">Person Reference</Label>
              <Select
                value={settings.personReference}
                onValueChange={(v) => setSettings((s) => ({ ...s, personReference: v as PersonReferenceType }))}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue />
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

            {/* Auto Release */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="settings-autoRelease" className="text-sm font-normal">Auto release</Label>
                <Switch
                  id="settings-autoRelease"
                  checked={settings.autoRelease}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, autoRelease: v }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Automatically make report available when generation completes</p>
            </div>

            {/* Page Header Logo */}
            <div className="space-y-1.5">
              <Label className="text-sm">Page Header Logo</Label>
              <Select
                value={settings.pageHeaderLogo}
                onValueChange={(v) => setSettings((s) => ({ ...s, pageHeaderLogo: v as 'primary' | 'secondary' | 'none' }))}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Logo in the header of each printed page</p>
            </div>
          </div>

          <SheetFooter>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full">
              <Save className="size-3.5" />
              {isSavingSettings ? 'Saving…' : 'Save Settings'}
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
      MODE_COLORS[mode] ?? 'bg-gray-200 text-gray-600'
    )}>
      {mode}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Block Help Panel — contextual help shown in the right sidebar
// ---------------------------------------------------------------------------

function BlockHelpPanel({ blockType }: { blockType: BlockType }) {
  const help = BLOCK_HELP[blockType]
  if (!help) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <HelpCircle className="size-4 text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Block Guide</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{help.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{help.description}</p>
        {help.tips && (
          <div className="rounded-lg bg-muted/50 p-3 mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Tip</p>
            <p className="text-xs text-muted-foreground">{help.tips}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Campaign Linkage Panel
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
              placeholder="Search campaigns…"
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
                  <SelectValue />
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

      <Separator />
    </div>
  )
}
