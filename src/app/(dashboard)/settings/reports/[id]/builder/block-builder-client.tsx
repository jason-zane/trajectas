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
import { cn } from '@/lib/utils'
import {
  BLOCK_REGISTRY,
  BLOCK_CATEGORIES,
} from '@/lib/reports/registry'
import type { BlockType, BlockConfig } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'
import { PRESENTATION_MODES, CHART_TYPES } from '@/lib/reports/presentation'
import {
  updateReportTemplateBlocks,
  updateReportTemplateSettings,
  getEntityOptions,
  type EntityOption,
} from '@/app/actions/reports'

type ReportType = 'self_report' | '360'

interface Props {
  templateId: string
  templateName: string
  reportType: ReportType
  initialBlocks: BlockConfig[]
}

function generateId(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// EntityCombobox — searchable single-select for entity IDs
// ---------------------------------------------------------------------------

interface EntityComboboxProps {
  value: string
  onChange: (id: string) => void
  options: EntityOption[]
}

function EntityCombobox({ value, onChange, options }: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selected = options.find((o) => o.id === value)

  return (
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
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : 'Select entity…'}
        </span>
        {selected && (
          <span className="text-xs text-muted-foreground">{selected.type}</span>
        )}
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground ml-auto" />
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
              No entities found.
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={(v) => {
                    onChange(v)
                    setOpen(false)
                    setSearch('')
                  }}
                  data-checked={opt.id === value}
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
  )
}

// ---------------------------------------------------------------------------
// EntityMultiSelect — chip list + add combobox for entityIds arrays
// ---------------------------------------------------------------------------

interface EntityMultiSelectProps {
  value: string[]
  onChange: (ids: string[]) => void
  options: EntityOption[]
}

function EntityMultiSelect({ value, onChange, options }: EntityMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = value
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean) as EntityOption[]

  const available = options.filter((o) => !value.includes(o.id))
  const filtered = search.trim()
    ? available.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : available

  function remove(id: string) {
    onChange(value.filter((v) => v !== id))
  }

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
                onClick={() => remove(opt.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
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
          <span className="text-muted-foreground">Add entity…</span>
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
// Numeric field names that should use <Input type="number">
// ---------------------------------------------------------------------------

const NUMERIC_FIELDS = new Set([
  'topN',
  'maxItems',
  'gapThreshold',
  'minRatersForDisplay',
])

// ---------------------------------------------------------------------------
// Select-based enum fields
// ---------------------------------------------------------------------------

const ENUM_FIELDS: Record<string, { label: string; options: string[] }> = {
  displayLevel: {
    label: 'Display Level',
    options: ['dimension', 'factor', 'construct'],
  },
  chartType: {
    label: 'Chart Type',
    options: ['radar', 'bars'],
  },
  style: {
    label: 'Style',
    options: ['cards', 'list'],
  },
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function BlockBuilderClient({
  templateId,
  templateName: initialName,
  reportType,
  initialBlocks,
}: Props) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<BlockConfig[]>(initialBlocks)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    initialBlocks[0]?.id ?? null,
  )
  const [name, setName] = useState(initialName)
  const [isSaving, startSave] = useTransition()
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])

  useEffect(() => {
    getEntityOptions().then(setEntityOptions)
  }, [])

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null

  // ---------------------------------------------------------------------------
  // Save
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
    setSelectedBlockId(newBlock.id)
  }

  // ---------------------------------------------------------------------------
  // Remove block
  // ---------------------------------------------------------------------------
  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (selectedBlockId === id) setSelectedBlockId(null)
  }

  // ---------------------------------------------------------------------------
  // Update selected block config
  // ---------------------------------------------------------------------------
  const updateConfig = useCallback((key: string, value: unknown) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === selectedBlockId
          ? { ...b, config: { ...b.config, [key]: value } }
          : b,
      ),
    )
  }, [selectedBlockId])

  // ---------------------------------------------------------------------------
  // Drag to reorder (simple index-swap approach)
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
  // Palette — group blocks by category, filter 360 if self_report template
  // ---------------------------------------------------------------------------
  const paletteCategories = Object.entries(BLOCK_CATEGORIES)
    .sort(([, a], [, b]) => a.order - b.order)
    .filter(([cat]) => reportType === '360' || cat !== '360')

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
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => handleDragStart(block.id)}
                    onDragOver={(e) => handleDragOver(e, block.id)}
                    onDrop={() => handleDrop(block.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={cn(
                      'group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all',
                      'bg-card hover:border-primary/40',
                      selectedBlockId === block.id
                        ? 'border-primary shadow-sm'
                        : 'border-border',
                      dragOverId === block.id && draggingId !== block.id
                        ? 'border-primary/60 bg-primary/5'
                        : '',
                      draggingId === block.id ? 'opacity-50' : '',
                    )}
                  >
                    <GripVertical className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{meta.label}</p>
                        <ModeTag mode={block.presentationMode ?? meta.defaultMode} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {meta.description}
                      </p>
                    </div>
                    {block.printBreakBefore && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Page break</Badge>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Config panel */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-4">
          {selectedBlock ? (
            <BlockConfigPanel
              block={selectedBlock}
              entityOptions={entityOptions}
              onUpdateConfig={updateConfig}
              onUpdateBlock={(updates) =>
                setBlocks((prev) =>
                  prev.map((b) => (b.id === selectedBlock.id ? { ...b, ...updates } : b)),
                )
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center py-8">
              <Settings className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Select a block to configure it.
              </p>
            </div>
          )}
        </div>
      </div>
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
// Config panel
// ---------------------------------------------------------------------------

interface ConfigPanelProps {
  block: BlockConfig
  entityOptions: EntityOption[]
  onUpdateConfig: (key: string, value: unknown) => void
  onUpdateBlock: (updates: Partial<BlockConfig>) => void
}

function BlockConfigPanel({ block, entityOptions, onUpdateConfig, onUpdateBlock }: ConfigPanelProps) {
  const meta = BLOCK_REGISTRY[block.type]

  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-sm">{meta.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
      </div>

      <Separator />

      {/* Presentation mode */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Presentation</p>

        {/* Mode selector */}
        <div className="space-y-1.5">
          <Label className="text-sm">Mode</Label>
          <Select
            value={block.presentationMode ?? meta.defaultMode}
            onValueChange={(v) => onUpdateBlock({ presentationMode: v as PresentationMode })}
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

        {/* Columns (only for carded mode) */}
        {(block.presentationMode ?? meta.defaultMode) === 'carded' && (
          <div className="space-y-1.5">
            <Label className="text-sm">Columns</Label>
            <Select
              value={String(block.columns ?? 1)}
              onValueChange={(v) => onUpdateBlock({ columns: Number(v) as 1 | 2 | 3 })}
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

        {/* Chart type (only for blocks with supportedCharts) */}
        {meta.supportedCharts && meta.supportedCharts.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-sm">Chart Type</Label>
            <Select
              value={block.chartType ?? meta.supportedCharts[0]}
              onValueChange={(v) => onUpdateBlock({ chartType: v as ChartType })}
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

        {/* Inset accent (only for inset mode) */}
        {(block.presentationMode ?? meta.defaultMode) === 'inset' && (
          <div className="space-y-1.5">
            <Label className="text-sm">Accent Colour</Label>
            <Select
              value={block.insetAccent ?? 'default'}
              onValueChange={(v) => onUpdateBlock({ insetAccent: v === 'default' ? undefined : v ?? undefined })}
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
      </div>

      <Separator />

      {/* Type-aware config fields */}
      <div className="space-y-4">
        {Object.entries(block.config as Record<string, unknown>).map(([key, val]) => {
          if (key.startsWith('_')) return null // internal flags

          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())

          // Boolean → Switch (no change)
          if (typeof val === 'boolean') {
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <Label htmlFor={`config-${key}`} className="text-sm font-normal">
                  {label}
                </Label>
                <Switch
                  id={`config-${key}`}
                  checked={val}
                  onCheckedChange={(checked) => onUpdateConfig(key, checked)}
                />
              </div>
            )
          }

          // entityId → EntityCombobox
          if (key === 'entityId') {
            return (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm">{label}</Label>
                <EntityCombobox
                  value={String(val ?? '')}
                  onChange={(id) => onUpdateConfig(key, id)}
                  options={entityOptions}
                />
              </div>
            )
          }

          // entityIds → EntityMultiSelect
          if (key === 'entityIds') {
            const ids = Array.isArray(val) ? (val as string[]) : []
            return (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm">{label}</Label>
                <EntityMultiSelect
                  value={ids}
                  onChange={(ids) => onUpdateConfig(key, ids)}
                  options={entityOptions}
                />
              </div>
            )
          }

          // Enum fields → Select
          if (key in ENUM_FIELDS) {
            const enumDef = ENUM_FIELDS[key]!
            return (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm">{label}</Label>
                <Select
                  value={String(val ?? '')}
                  onValueChange={(v) => onUpdateConfig(key, v)}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder={`Select ${enumDef.label.toLowerCase()}…`} />
                  </SelectTrigger>
                  <SelectContent>
                    {enumDef.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }

          // content → Textarea
          if (key === 'content') {
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`config-${key}`} className="text-sm">{label}</Label>
                <Textarea
                  id={`config-${key}`}
                  value={String(val ?? '')}
                  onChange={(e) => onUpdateConfig(key, e.target.value)}
                  className="text-sm min-h-24 resize-y"
                  placeholder="Markdown supported…"
                />
              </div>
            )
          }

          // Numeric fields → number Input
          if (NUMERIC_FIELDS.has(key) || typeof val === 'number') {
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`config-${key}`} className="text-sm">{label}</Label>
                <Input
                  id={`config-${key}`}
                  type="number"
                  value={val as number ?? ''}
                  onChange={(e) => onUpdateConfig(key, Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
            )
          }

          // String or null → text Input
          if (typeof val === 'string' || val === null) {
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`config-${key}`} className="text-sm">{label}</Label>
                <Input
                  id={`config-${key}`}
                  value={val ?? ''}
                  onChange={(e) => onUpdateConfig(key, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )
          }

          return null
        })}
      </div>

      <Separator />

      {/* Print options */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Print</p>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="print-break" className="text-sm font-normal">Page break before</Label>
          <Switch
            id="print-break"
            checked={block.printBreakBefore ?? false}
            onCheckedChange={(v) => onUpdateBlock({ printBreakBefore: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="print-hide" className="text-sm font-normal">Hide in PDF</Label>
          <Switch
            id="print-hide"
            checked={block.printHide ?? false}
            onCheckedChange={(v) => onUpdateBlock({ printHide: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="screen-hide" className="text-sm font-normal">Hide on screen</Label>
          <Switch
            id="screen-hide"
            checked={block.screenHide ?? false}
            onCheckedChange={(v) => onUpdateBlock({ screenHide: v })}
          />
        </div>
      </div>
    </div>
  )
}
