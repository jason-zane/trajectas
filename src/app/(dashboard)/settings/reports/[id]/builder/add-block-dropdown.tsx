'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { BLOCK_REGISTRY, BLOCK_CATEGORIES } from '@/lib/reports/registry'
import type { BlockType, BlockCategory } from '@/lib/reports/types'
import { useState } from 'react'

interface AddBlockDropdownProps {
  reportType: 'self_report' | '360'
  onAdd: (type: BlockType) => void
}

export function AddBlockDropdown({ reportType, onAdd }: AddBlockDropdownProps) {
  const [open, setOpen] = useState(false)

  const categories = Object.entries(BLOCK_CATEGORIES)
    .sort(([, a], [, b]) => a.order - b.order)
    .filter(([cat]) => reportType === '360' || cat !== '360') as [BlockCategory, { label: string; order: number }][]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" />
        }
      >
        <Plus className="size-3.5" />
        Add block
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
        <div className="p-2 space-y-1">
          {categories.map(([cat, { label }], catIdx) => {
            const categoryBlocks = Object.entries(BLOCK_REGISTRY).filter(
              ([, meta]) => meta.category === cat,
            )
            if (categoryBlocks.length === 0) return null

            return (
              <div key={cat}>
                {catIdx > 0 && <Separator className="my-1.5" />}
                <p className="text-overline text-primary px-2 pt-1 pb-0.5">{label}</p>
                {categoryBlocks.map(([type, meta]) => {
                  const isDeferred = meta.isDeferred || meta.is360Only
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (!isDeferred) {
                          onAdd(type as BlockType)
                          setOpen(false)
                        }
                      }}
                      disabled={isDeferred}
                      className={cn(
                        'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        'hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed',
                        'flex flex-col gap-0.5',
                      )}
                    >
                      <span className="font-medium">{meta.label}</span>
                      {isDeferred && (
                        <span className="text-[10px] text-muted-foreground">Coming soon</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
