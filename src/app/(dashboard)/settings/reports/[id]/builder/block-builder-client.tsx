'use client'

import { useState, useTransition, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  BLOCK_REGISTRY,
  BLOCK_CATEGORIES,
} from '@/lib/reports/registry'
import type { BlockType, BlockConfig } from '@/lib/reports/types'
import { updateReportTemplateBlocks, updateReportTemplateSettings } from '@/app/actions/reports'

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
            onClick={() => window.open(`/reports/preview/${templateId}`, '_blank')}
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
                      <p className="font-semibold text-sm">{meta.label}</p>
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
// Config panel
// ---------------------------------------------------------------------------

interface ConfigPanelProps {
  block: BlockConfig
  onUpdateConfig: (key: string, value: unknown) => void
  onUpdateBlock: (updates: Partial<BlockConfig>) => void
}

function BlockConfigPanel({ block, onUpdateConfig, onUpdateBlock }: ConfigPanelProps) {
  const meta = BLOCK_REGISTRY[block.type]

  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-sm">{meta.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
      </div>

      <Separator />

      {/* Generic config fields from defaultConfig shape */}
      <div className="space-y-4">
        {Object.entries(block.config as Record<string, unknown>).map(([key, val]) => {
          if (key.startsWith('_')) return null // internal flags

          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())

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

          if (typeof val === 'string' || typeof val === 'number' || val === null) {
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`config-${key}`} className="text-sm">
                  {label}
                </Label>
                <Input
                  id={`config-${key}`}
                  value={val ?? ''}
                  onChange={(e) => {
                    const v = typeof val === 'number' ? Number(e.target.value) : e.target.value
                    onUpdateConfig(key, v)
                  }}
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
