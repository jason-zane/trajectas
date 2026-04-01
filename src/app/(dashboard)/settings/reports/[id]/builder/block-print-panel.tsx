'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { BlockConfig } from '@/lib/reports/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BlockPrintPanelProps {
  block: BlockConfig
  onUpdateBlock: (updates: Partial<BlockConfig>) => void
}

// ---------------------------------------------------------------------------
// Block Print Panel — page break, PDF hide, screen hide
// ---------------------------------------------------------------------------

export function BlockPrintPanel({ block, onUpdateBlock }: BlockPrintPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label htmlFor={`${block.id}-breakBefore`} className="text-sm font-normal">
            Page break before
          </Label>
          <p className="text-xs text-muted-foreground">
            Start this block on a new page when printing
          </p>
        </div>
        <Switch
          id={`${block.id}-breakBefore`}
          checked={block.printBreakBefore ?? false}
          onCheckedChange={(v) => onUpdateBlock({ printBreakBefore: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label htmlFor={`${block.id}-printHide`} className="text-sm font-normal">
            Hide in PDF
          </Label>
          <p className="text-xs text-muted-foreground">
            Exclude this block from the printed/exported PDF
          </p>
        </div>
        <Switch
          id={`${block.id}-printHide`}
          checked={block.printHide ?? false}
          onCheckedChange={(v) => onUpdateBlock({ printHide: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label htmlFor={`${block.id}-screenHide`} className="text-sm font-normal">
            Hide on screen
          </Label>
          <p className="text-xs text-muted-foreground">
            Only show this block in the PDF, not in the web preview
          </p>
        </div>
        <Switch
          id={`${block.id}-screenHide`}
          checked={block.screenHide ?? false}
          onCheckedChange={(v) => onUpdateBlock({ screenHide: v })}
        />
      </div>
    </div>
  )
}
