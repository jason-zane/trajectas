import type { ReactNode, SelectHTMLAttributes } from "react";
export function OutcomeField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint && (
        <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}
export function OutcomeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary ${props.className ?? ""}`}
    />
  );
}
