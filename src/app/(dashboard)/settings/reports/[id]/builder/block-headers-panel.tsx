'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { BlockConfig } from '@/lib/reports/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BlockHeadersPanelProps {
  block: BlockConfig
  onUpdateBlock: (updates: Partial<BlockConfig>) => void
}

// ---------------------------------------------------------------------------
// Block Headers Panel — eyebrow, heading, description for every block
// ---------------------------------------------------------------------------

export function BlockHeadersPanel({ block, onUpdateBlock }: BlockHeadersPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${block.id}-eyebrow`} className="text-sm">
          Eyebrow
        </Label>
        <Input
          id={`${block.id}-eyebrow`}
          value={block.eyebrow ?? ''}
          onChange={(e) => onUpdateBlock({ eyebrow: e.target.value })}
          placeholder="e.g. Your Profile"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${block.id}-heading`} className="text-sm">
          Heading
        </Label>
        <Input
          id={`${block.id}-heading`}
          value={block.heading ?? ''}
          onChange={(e) => onUpdateBlock({ heading: e.target.value })}
          placeholder="e.g. Score Overview"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${block.id}-description`} className="text-sm">
          Description
        </Label>
        <Textarea
          id={`${block.id}-description`}
          value={block.blockDescription ?? ''}
          onChange={(e) => onUpdateBlock({ blockDescription: e.target.value })}
          placeholder="Optional supporting text..."
          className="text-sm min-h-20 resize-y"
        />
      </div>
    </div>
  )
}
