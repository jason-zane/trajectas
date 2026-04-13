"use client"

import type { ReactNode, KeyboardEvent } from "react"
import { useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface RouteTab {
  label: string
  segment: string
  badge?: ReactNode
}

interface RouteTabsProps {
  tabs: RouteTab[]
  basePath: string
  activeSegment: string
  className?: string
}

export function RouteTabs({ tabs, basePath, activeSegment, className }: RouteTabsProps) {
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])

  function handleKeyDown(e: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      const next = (index + 1) % tabs.length
      tabRefs.current[next]?.focus()
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      const prev = (index - 1 + tabs.length) % tabs.length
      tabRefs.current[prev]?.focus()
    }
  }

  return (
    <nav
      role="tablist"
      aria-label="Page sections"
      className={cn(
        "flex gap-0 overflow-x-auto border-b border-border scrollbar-none",
        className
      )}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.segment === activeSegment
        return (
          <Link
            key={tab.segment}
            ref={(el) => { tabRefs.current[i] = el }}
            href={`${basePath}/${tab.segment}`}
            role="tab"
            aria-current={isActive ? "page" : undefined}
            aria-selected={isActive}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium",
              "transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              "hover:bg-muted/50",
              isActive
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:content-['']"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
            {tab.badge && <span className="ml-1">{tab.badge}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
