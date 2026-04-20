import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface BrandedMessageProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}

export function BrandedMessage({
  eyebrow,
  title,
  description,
  actions,
  footer,
}: BrandedMessageProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start px-6 py-20">
      <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/30">
        <AlertTriangle className="size-6 text-[var(--gold)]" />
      </div>
      <p className="mt-6 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-sans text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      {description && (
        <div className="mt-3 text-[1rem] leading-relaxed text-muted-foreground">
          {description}
        </div>
      )}
      {actions && (
        <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
      )}
      {footer}
    </div>
  );
}
