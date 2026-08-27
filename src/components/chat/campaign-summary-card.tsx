'use client'

// =============================================================================
// CampaignSummaryCard — participation figures for one campaign.
//
// Every figure is shown with what it is a figure OF, so a number can never be
// read as a completion rate when it is a headcount.
// =============================================================================

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { CampaignSummaryBlock } from '@/lib/chat/envelope'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export function CampaignSummaryCard({ block }: { block: CampaignSummaryBlock }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {block.campaignTitle ?? 'Untitled campaign'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[block.clientName, block.status].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {block.href ? (
          <Link
            href={block.href}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open campaign
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 px-3 py-3">
        <Stat label="Invited" value={block.invited} />
        <Stat label="Started" value={block.started} />
        <Stat label="Completed" value={block.completed} />
      </div>

      {block.caveats.length > 0 && (
        <div className="border-t border-border bg-muted/40 px-3 py-2">
          <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
            {block.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
