"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRight,
  LayoutGrid,
  Brain,
  Dna,
  FileQuestion,
  Home,
} from "lucide-react"
import { cn } from "@/lib/utils"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const segmentConfig: Record<
  string,
  { label: string; icon?: typeof Home; color?: string }
> = {
  dimensions: {
    label: "Dimensions",
    icon: LayoutGrid,
    color: "text-dimension-accent",
  },
  factors: {
    label: "Factors",
    icon: Brain,
    color: "text-competency-accent",
  },
  constructs: { label: "Constructs", icon: Dna, color: "text-trait-accent" },
  items: {
    label: "Items",
    icon: FileQuestion,
    color: "text-item-accent",
  },
  create: { label: "Create" },
  edit: { label: "Edit" },
  assessments: { label: "Assessments" },
  diagnostics: { label: "Diagnostics" },
  templates: { label: "Templates" },
  organizations: { label: "Organisations" },
  matching: { label: "AI Matching" },
  settings: { label: "Settings" },
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  // Build crumbs, skipping UUID segments but preserving correct hrefs.
  // Each crumb's href includes the full path up to that original segment
  // (including any UUIDs between visible segments).
  const crumbs: {
    href: string
    config: { label: string; icon?: typeof Home; color?: string }
    Icon?: typeof Home
  }[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (UUID_RE.test(segment)) continue

    const href = "/" + segments.slice(0, i + 1).join("/")
    const config = segmentConfig[segment] || {
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
    }
    crumbs.push({ href, config, Icon: config.icon })
  }

  return (
    <nav
      className={cn("flex items-center gap-1 text-sm", className)}
      aria-label="Breadcrumb"
    >
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="size-3.5" />
      </Link>
      {crumbs.map(({ href, config, Icon }, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <div key={href} className="flex items-center gap-1">
            <ChevronRight className="size-3 text-muted-foreground/50" />
            {isLast ? (
              <span
                className={cn(
                  "font-medium flex items-center gap-1",
                  config.color || "text-foreground"
                )}
              >
                {Icon && <Icon className="size-3.5" />}
                {config.label}
              </span>
            ) : (
              <Link
                href={href}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {Icon && <Icon className={cn("size-3.5", config.color)} />}
                {config.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
