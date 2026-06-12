'use client'

// =============================================================================
// AddBlockGallery — the visual block picker. Every block type is shown as a
// thumbnail of what it actually renders, so admins pick by sight, not label.
// Replaces the old text dropdown.
// =============================================================================

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { BLOCK_CATEGORIES, getBuilderBlockEntries } from '@/lib/reports/registry'
import type { BlockType, BlockCategory } from '@/lib/reports/types'

interface AddBlockGalleryProps {
  reportType: 'self_report' | '360'
  onAdd: (type: BlockType) => void
  /** 'button' = labelled toolbar button; 'inline' = small round + between blocks. */
  variant?: 'button' | 'inline'
}

export function AddBlockGallery({ reportType, onAdd, variant = 'button' }: AddBlockGalleryProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<BlockCategory | 'all'>('all')

  const availableBlocks = useMemo(() => getBuilderBlockEntries(reportType), [reportType])

  const categories = (Object.entries(BLOCK_CATEGORIES) as [BlockCategory, { label: string; order: number }][])
    .sort(([, a], [, b]) => a.order - b.order)
    .filter(([cat]) => availableBlocks.some(([, meta]) => meta.category === cat))

  const filtered = availableBlocks.filter(([, meta]) => {
    if (category !== 'all' && meta.category !== category) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return meta.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q)
  })

  function handleAdd(type: BlockType) {
    onAdd(type)
    setOpen(false)
    setSearch('')
    setCategory('all')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          variant === 'inline' ? (
            <button
              type="button"
              aria-label="Add block here"
              className="flex size-6 items-center justify-center rounded-full border border-border bg-card text-primary transition-colors hover:border-primary/50 hover:bg-primary/5"
            />
          ) : (
            <Button variant="outline" size="sm" />
          )
        }
      >
        <Plus className="size-3.5" />
        {variant === 'button' && 'Add block'}
      </DialogTrigger>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
          <DialogTitle>Add a block</DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>
              All
            </CategoryChip>
            {categories.map(([cat, { label }]) => (
              <CategoryChip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
                {label}
              </CategoryChip>
            ))}
          </div>
        </DialogHeader>
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No blocks match your search.
            </p>
          )}
          {filtered.map(([type, meta]) => (
            <button
              key={type}
              type="button"
              onClick={() => handleAdd(type as BlockType)}
              className="group rounded-xl border border-border bg-card p-2.5 text-left transition-all hover:border-primary/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div className="mb-2 h-16 overflow-hidden rounded-lg bg-cream p-2.5 dark:bg-muted/40">
                <BlockThumb type={type as BlockType} />
              </div>
              <p className="text-xs font-semibold">{meta.label}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {meta.description}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-emerald-dark bg-emerald-dark text-white dark:border-primary dark:bg-primary'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// BlockThumb — tiny skeleton rendering of what each block type produces.
// Uses app tokens only (the report theme vars don't exist in builder scope).
// ---------------------------------------------------------------------------

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('h-1 rounded-full bg-foreground/15', className)} />
}

function ThumbBar({ width, tone }: { width: string; tone: 'high' | 'mid' | 'low' }) {
  const toneClass =
    tone === 'high' ? 'bg-primary' : tone === 'mid' ? 'bg-gold' : 'bg-destructive/70'
  return (
    <div className="relative h-1 flex-1 rounded-full bg-foreground/10">
      <div className={cn('absolute inset-y-0 left-0 rounded-full', toneClass)} style={{ width }} />
    </div>
  )
}

function ThumbRow({ width, tone }: { width: string; tone: 'high' | 'mid' | 'low' }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 last:mb-0">
      <SkeletonLine className="w-8 shrink-0" />
      <ThumbBar width={width} tone={tone} />
      <SkeletonLine className="w-2 shrink-0" />
    </div>
  )
}

function BlockThumb({ type }: { type: BlockType }) {
  switch (type) {
    case 'cover_page':
      return (
        <div className="-m-2.5 flex h-[calc(100%+1.25rem)] flex-col justify-center gap-1.5 bg-emerald-dark p-3">
          <div className="h-0.5 w-5 rounded-full bg-gold" />
          <div className="h-1.5 w-3/5 rounded-full bg-white/80" />
          <div className="h-1 w-2/5 rounded-full bg-white/35" />
        </div>
      )
    case 'contents':
      return (
        <div className="space-y-1.5">
          {['w-3/4', 'w-2/3', 'w-4/5'].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="font-mono text-[8px] leading-none text-gold">{String(i + 1).padStart(2, '0')}</span>
              <SkeletonLine className={w} />
            </div>
          ))}
        </div>
      )
    case 'custom_text':
      return (
        <div className="space-y-1.5">
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-11/12" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-3/5" />
        </div>
      )
    case 'section_divider':
      return (
        <div className="flex h-full items-center">
          <div className="h-px w-full bg-foreground/25" />
        </div>
      )
    case 'closing_page':
      return (
        <div className="space-y-1.5">
          <div className="h-1 w-1/3 rounded-full bg-gold/70" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-4/5" />
          <div className="flex items-center gap-1 pt-0.5">
            <span className="size-1.5 rounded-full bg-destructive/70" />
            <span className="size-1.5 rounded-full bg-gold" />
            <span className="size-1.5 rounded-full bg-primary" />
          </div>
        </div>
      )
    case 'score_overview':
      return (
        <div>
          <ThumbRow width="78%" tone="high" />
          <ThumbRow width="55%" tone="mid" />
          <ThumbRow width="34%" tone="low" />
        </div>
      )
    case 'dimension_chapter':
      return (
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <div className="h-1.5 w-1/3 rounded-full bg-foreground/30" />
            <span className="font-mono text-[8px] leading-none text-foreground/50">68</span>
          </div>
          <div className="mb-1.5 h-1 rounded-full bg-foreground/10">
            <div className="h-1 w-2/3 rounded-full bg-gold" />
          </div>
          <ThumbRow width="80%" tone="high" />
          <ThumbRow width="48%" tone="mid" />
        </div>
      )
    case 'score_detail':
      return (
        <div className="space-y-1.5">
          <div className="h-1.5 w-2/5 rounded-full bg-foreground/30" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-3/4" />
          <div className="h-1 rounded-full bg-foreground/10">
            <div className="h-1 w-3/5 rounded-full bg-primary" />
          </div>
        </div>
      )
    case 'score_interpretation':
    case 'score_interpretation_v2':
      return (
        <div className="space-y-2">
          {[64, 81].map((v) => (
            <div key={v} className="flex items-center gap-1.5">
              <SkeletonLine className="w-7 shrink-0" />
              <div className="relative h-1.5 flex-1 rounded-sm bg-foreground/10">
                <span className="absolute inset-y-[-2px] left-[40%] w-px bg-foreground/25" />
                <span className="absolute inset-y-[-2px] left-[70%] w-px bg-foreground/25" />
                <span
                  className="absolute inset-y-0 w-0.5 rounded-full bg-emerald-dark dark:bg-primary"
                  style={{ left: `${v}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )
    case 'strengths_highlights':
      return (
        <div className="grid h-full grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-md border border-border bg-card p-1">
              <span className="font-mono text-[8px] leading-none text-gold">{String(i + 1).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      )
    case 'development_plan':
      return (
        <div className="space-y-1.5">
          {['w-4/5', 'w-3/5', 'w-2/3'].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="font-mono text-[8px] leading-none text-gold">{String(i + 1).padStart(2, '0')}</span>
              <SkeletonLine className={w} />
            </div>
          ))}
        </div>
      )
    case 'ai_text':
      return (
        <div className="space-y-1.5">
          <div className="h-1 w-1/4 rounded-full bg-gold/70" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-5/6" />
          <SkeletonLine className="w-2/3" />
        </div>
      )
    default:
      return (
        <div className="space-y-1.5">
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-5/6" />
        </div>
      )
  }
}
