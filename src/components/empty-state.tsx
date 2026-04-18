import Link from "next/link"
import {
  LayoutGrid,
  Brain,
  Dna,
  FileQuestion,
  Inbox,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const variantConfig = {
  dimension: {
    icon: LayoutGrid,
    bgClass: "bg-dimension-bg",
    iconClass: "text-dimension-accent",
  },
  competency: {
    icon: Brain,
    bgClass: "bg-competency-bg",
    iconClass: "text-competency-accent",
  },
  trait: {
    icon: Dna,
    bgClass: "bg-trait-bg",
    iconClass: "text-trait-accent",
  },
  item: {
    icon: FileQuestion,
    bgClass: "bg-item-bg",
    iconClass: "text-item-accent",
  },
  default: {
    icon: Inbox,
    bgClass: "bg-muted ring-1 ring-border",
    iconClass: "text-muted-foreground",
  },
}

interface EmptyStateProps {
  variant?: keyof typeof variantConfig
  size?: "sm" | "default"
  eyebrow?: string
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  className?: string
}

export function EmptyState({
  variant = "default",
  size = "default",
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant]
  const Icon = config.icon
  const isSm = size === "sm"

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-[var(--cream)]/20 px-6 animate-fade-in-up",
        isSm ? "py-10" : "py-16",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl",
          isSm ? "size-11" : "size-14",
          config.bgClass
        )}
      >
        <Icon className={cn(isSm ? "size-5" : "size-7", config.iconClass)} />
      </div>
      {eyebrow && (
        <p className="mt-5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">
          {eyebrow}
        </p>
      )}
      <h3
        className={cn(
          "font-sans font-semibold tracking-[-0.01em] text-foreground",
          isSm ? "text-base" : "text-lg",
          eyebrow ? "mt-2" : isSm ? "mt-4" : "mt-5",
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "mt-2 text-center text-muted-foreground",
          isSm ? "max-w-xs text-sm" : "max-w-sm text-[0.9375rem] leading-relaxed",
        )}
      >
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button className="mt-6">
            <Plus className="size-4" />
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  )
}
