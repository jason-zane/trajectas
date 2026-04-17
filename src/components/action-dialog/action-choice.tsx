"use client";

import Link from "next/link";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

interface ActionChoiceProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  recommended?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onClick?: () => void;
  href?: string;
  className?: string;
}

const BASE_CLASSES =
  "group relative flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all duration-200 ease-spring hover:border-primary/60 hover:bg-primary/5 hover:scale-[1.01] active:scale-[0.99]";

export function ActionChoice({
  icon: Icon,
  title,
  description,
  recommended,
  disabled,
  disabledHint,
  onClick,
  href,
  className,
}: ActionChoiceProps) {
  if (disabled) {
    return (
      <div
        className={cn(
          "relative flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6 opacity-80",
          className,
        )}
      >
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground">{title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {disabledHint ?? description}
          </p>
        </div>
      </div>
    );
  }

  const inner = (
    <>
      {recommended ? (
        <span className="absolute -top-2 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
          Recommended
        </span>
      ) : null}
      <div
        className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-shadow duration-300 group-hover:shadow-[0_0_20px_var(--glow-color)]"
        style={{ "--glow-color": "var(--primary)" } as React.CSSProperties}
      >
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(BASE_CLASSES, className)}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(BASE_CLASSES, className)}>
      {inner}
    </button>
  );
}
