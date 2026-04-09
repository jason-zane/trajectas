'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getSelectLabel } from '@/lib/select-display'
import { BLOCK_REGISTRY } from '@/lib/reports/registry'
import type { BlockConfig } from '@/lib/reports/types'
import type { PresentationMode, ChartType } from '@/lib/reports/presentation'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BlockPresentationPanelProps {
  block: BlockConfig
  onUpdateBlock: (updates: Partial<BlockConfig>) => void
}

// ---------------------------------------------------------------------------
// Inset accent options
// ---------------------------------------------------------------------------

const INSET_ACCENT_OPTIONS = [
  { value: '', label: 'Default (Sage)' },
  { value: '#c9a962', label: 'Gold' },
  { value: '#5b3fc5', label: 'Violet' },
  { value: '#b85c6a', label: 'Rose' },
] as const

// ---------------------------------------------------------------------------
// Block Presentation Panel — mode, chart type, columns, inset accent
// ---------------------------------------------------------------------------

export function BlockPresentationPanel({ block, onUpdateBlock }: BlockPresentationPanelProps) {
  const meta = BLOCK_REGISTRY[block.type]
  const supportedModes = meta.supportedModes
  const supportedCharts = meta.supportedCharts
  const currentMode = block.presentationMode ?? meta.defaultMode

  // Nothing to configure for blocks with no supported modes (e.g. section_divider)
  if (supportedModes.length === 0 && !supportedCharts?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No presentation options for this block type.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      {supportedModes.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm">Mode</Label>
          <Select
            value={currentMode}
            onValueChange={(v) => onUpdateBlock({ presentationMode: v as PresentationMode })}
          >
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue>
                {(value: string | null) =>
                  getSelectLabel(
                    value,
                    supportedModes.map((mode) => ({
                      value: mode,
                      label: mode.charAt(0).toUpperCase() + mode.slice(1),
                    }))
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {supportedModes.map((mode) => (
                <SelectItem key={mode} value={mode} className="capitalize">
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Chart type selector */}
      {supportedCharts && supportedCharts.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm">Chart Type</Label>
          <Select
            value={block.chartType ?? supportedCharts[0]}
            onValueChange={(v) => onUpdateBlock({ chartType: v as ChartType })}
          >
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue>
                {(value: string | null) =>
                  getSelectLabel(
                    value,
                    supportedCharts.map((chart) => ({
                      value: chart,
                      label: chart.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
                    }))
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {supportedCharts.map((chart) => (
                <SelectItem key={chart} value={chart} className="capitalize">
                  {chart.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Columns — only when mode is 'carded' */}
      {currentMode === 'carded' && (
        <div className="space-y-1.5">
          <Label className="text-sm">Columns</Label>
          <Select
            value={String(block.columns ?? 2)}
            onValueChange={(v) => onUpdateBlock({ columns: Number(v) as 1 | 2 | 3 })}
          >
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue>
                {(value: string | null) =>
                  getSelectLabel(value, [
                    { value: '1', label: '1 Column' },
                    { value: '2', label: '2 Columns' },
                    { value: '3', label: '3 Columns' },
                  ])
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Column</SelectItem>
              <SelectItem value="2">2 Columns</SelectItem>
              <SelectItem value="3">3 Columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Inset accent — only when mode is 'inset' */}
      {currentMode === 'inset' && (
        <div className="space-y-1.5">
          <Label className="text-sm">Inset Accent</Label>
          <Select
            value={block.insetAccent ?? ''}
            onValueChange={(v) => onUpdateBlock({ insetAccent: v ?? undefined })}
          >
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue placeholder="Default (Sage)">
                {(value: string | null) =>
                  getSelectLabel(
                    value,
                    INSET_ACCENT_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                    "Default (Sage)"
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {INSET_ACCENT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.value && (
                      <span
                        className="inline-block size-3 rounded-full shrink-0"
                        style={{ backgroundColor: opt.value }}
                      />
                    )}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
