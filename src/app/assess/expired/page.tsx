import { getEffectiveExperience } from "@/app/actions/experience";
import { getPageContent } from "@/lib/experience/resolve";
import { XCircle } from "lucide-react";

export default async function ExpiredPage() {
  const experience = await getEffectiveExperience();
  const content = getPageContent(experience, "expired");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header
        className="flex h-14 items-center px-4 sm:px-6"
        style={{
          background: "var(--brand-neutral-50, hsl(var(--background)))",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex size-7 items-center justify-center rounded-lg"
            style={{
              background: "var(--brand-surface, hsl(var(--primary) / 0.1))",
            }}
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: "var(--brand-primary, hsl(var(--primary)))",
              }}
            >
              <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              color: "var(--brand-text, hsl(var(--foreground)))",
            }}
          >
            Trajectas
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-10 text-destructive" />
            </div>
          </div>

          <div className="space-y-3">
            <h1
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {content.heading}
            </h1>
            <p
              className="mx-auto max-w-md leading-relaxed"
              style={{
                color:
                  "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
              }}
            >
              {content.body}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-4 py-4">
        <span
          className="text-xs"
          style={{
            color:
              "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
          }}
        >
          {content.footerText ?? "Trajectas"}
        </span>
      </footer>
    </div>
  );
}
