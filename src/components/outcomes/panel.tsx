import type { ReactNode } from "react";
export function OutcomePanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 md:p-7">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-6 min-w-0">{children}</div>
    </section>
  );
}
