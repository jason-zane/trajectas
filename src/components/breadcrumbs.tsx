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
const INTERNAL_WORKSPACE_SEGMENTS = new Set(["partner", "client"])

// Segments that have their own page (i.e. a list/index page)
const ROUTABLE_SEGMENTS = new Set([
  "dimensions",
  "factors",
  "constructs",
  "items",
  "assessments",
  "diagnostics",
  "templates",
  "clients",
  "matching",
  "psychometrics",
  "settings",
])

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
  clients: { label: "Clients" },
  matching: { label: "AI Matching" },
  psychometrics: { label: "Psychometrics" },
  reliability: { label: "Scale Reliability" },
  norms: { label: "Norm Explorer" },
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
    isLinkable: boolean
  }[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (UUID_RE.test(segment)) continue
    if (i === 0 && INTERNAL_WORKSPACE_SEGMENTS.has(segment)) continue

    const href = "/" + segments.slice(0, i + 1).join("/")
    const config = segmentConfig[segment] || {
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
    }
    // Only known routable segments get clickable links;
    // slugs and terminal segments like "edit"/"create" are display-only
    const isLinkable = ROUTABLE_SEGMENTS.has(segment)
    crumbs.push({ href, config, Icon: config.icon, isLinkable })
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
      {crumbs.map(({ href, config, Icon, isLinkable }, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <div key={href} className="flex items-center gap-1">
            <ChevronRight className="size-3 text-muted-foreground/50" />
            {isLast || !isLinkable ? (
              <span
                className={cn(
                  "flex items-center gap-1",
                  isLast
                    ? cn("font-medium", config.color || "text-foreground")
                    : "text-muted-foreground"
                )}
              >
                {Icon && <Icon className={cn("size-3.5", config.color)} />}
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
