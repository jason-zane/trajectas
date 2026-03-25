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
    bgClass: "bg-muted",
    iconClass: "text-muted-foreground",
  },
}

interface EmptyStateProps {
  variant?: keyof typeof variantConfig
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  className?: string
}

export function EmptyState({
  variant = "default",
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 px-6 animate-fade-in-up",
        className
      )}
    >
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-2xl animate-pulse-glow",
          config.bgClass
        )}
      >
        <Icon className={cn("size-8", config.iconClass)} />
      </div>
      <h3 className="mt-6 text-title font-medium">{title}</h3>
      <p className="mt-2 text-body text-muted-foreground text-center max-w-sm">
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
