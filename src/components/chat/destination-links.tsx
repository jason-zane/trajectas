'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { BlockDestination } from '@/lib/chat/envelope'

/**
 * Where the answer continues. Chat gives the short version; these carry the
 * user into the real surface with this answer's state already loaded, so they
 * never re-enter what they just asked for.
 */
export function DestinationLinks({ destinations }: { destinations: BlockDestination[] }) {
  if (destinations.length === 0) return null
  return (
    <div className="flex flex-col divide-y divide-border border-t border-border">
      {destinations.map((destination) => (
        <Link
          key={destination.href}
          href={destination.href}
          className="group flex items-start gap-2 px-3 py-2.5 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-primary">
              {destination.label}
            </span>
            <span className="block text-[11px] leading-snug text-muted-foreground">
              {destination.description}
            </span>
          </span>
          <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  )
}
