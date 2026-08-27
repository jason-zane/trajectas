'use client'

import Link from 'next/link'
import { Users, Megaphone, ClipboardList, Building2, FileText } from 'lucide-react'
import type { EntityLink } from '@/lib/chat/envelope'

const ICONS = {
  participant: Users,
  campaign: Megaphone,
  assessment: ClipboardList,
  client: Building2,
  session: FileText,
} as const

/**
 * Resolved entities rendered as real links. Every grounded answer ends in a
 * route the user can open to corroborate it — the assistant is checkable, not
 * merely confident.
 */
export function EntityLinksBlockView({
  title,
  links,
}: {
  title: string
  links: EntityLink[]
}) {
  if (links.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-background/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="ml-1.5 normal-case tracking-normal">({links.length})</span>
      </div>
      <ul className="divide-y divide-border">
        {links.map((link) => {
          const Icon = ICONS[link.kind] ?? FileText
          const body = (
            <span className="flex items-center gap-2.5 min-w-0">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{link.label}</span>
                {link.sublabel ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {link.sublabel}
                  </span>
                ) : null}
              </span>
            </span>
          )
          return (
            <li key={`${link.kind}:${link.id}`}>
              {link.href ? (
                <Link
                  href={link.href}
                  className="block px-3 py-2 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  {body}
                </Link>
              ) : (
                <span className="block px-3 py-2">{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
