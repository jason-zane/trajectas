import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 animate-fade-in-up",
        className
      )}
    >
      <div>
        {eyebrow && (
          <p className="text-overline text-primary mb-2">{eyebrow}</p>
        )}
        <h1 className="text-headline font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-body text-muted-foreground mt-2 max-w-lg">
            {description}
          </p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
