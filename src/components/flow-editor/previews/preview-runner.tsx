"use client"

import type { RunnerContent } from "@/lib/experience/types"

interface PreviewRunnerProps {
  content: RunnerContent
}

export function PreviewRunner({ content }: PreviewRunnerProps) {
  return (
    <div
      className="flex flex-col min-h-[400px] overflow-hidden"
      style={{
        borderRadius: "var(--brand-radius-xl)",
        backgroundColor: "var(--brand-neutral-50)",
        fontFamily: "var(--brand-font-body)",
      }}
    >
      {/* Header with brand + back button */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--brand-neutral-200)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="size-5 rounded-md"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
          <span
            className="text-xs font-semibold"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            Trajectas
          </span>
        </div>
        <span
          className="text-[10px]"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.backButtonLabel}
        </span>
      </div>

      {/* Progress bar mock */}
      <div
        className="h-1"
        style={{ backgroundColor: "var(--brand-neutral-200)" }}
      >
        <div
          className="h-full rounded-r-full"
          style={{
            width: "40%",
            backgroundColor: "var(--brand-primary)",
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-6">
        {/* Assessment name eyebrow */}
        <p
          className="mb-3 text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--brand-primary)" }}
        >
          Assessment Name
        </p>

        {/* Mock Likert question card */}
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--brand-neutral-200)",
            backgroundColor: "var(--brand-neutral-50)",
          }}
        >
          <p
            className="mb-4 text-sm leading-relaxed"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            I enjoy working collaboratively with others to solve problems.
          </p>

          {/* Mock likert options */}
          <div className="flex gap-1.5">
            {["SD", "D", "N", "A", "SA"].map((label, i) => (
              <div
                key={label}
                className="flex-1 rounded-lg py-1.5 text-center text-[9px] font-medium transition-colors"
                style={{
                  backgroundColor: i === 3 ? "var(--brand-primary)" : "var(--brand-neutral-100)",
                  color: i === 3 ? "var(--brand-primary-foreground)" : "var(--brand-text-muted)",
                  border: i === 3 ? "none" : "1px solid var(--brand-neutral-200)",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with save status */}
      <div
        className="flex items-center justify-center gap-1.5 px-4 py-3"
        style={{ borderTop: "1px solid var(--brand-neutral-200)" }}
      >
        <span
          className="inline-block size-1.5 rounded-full"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
        <span
          className="text-[10px]"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.saveStatusIdle}
        </span>
        {content.footerText && (
          <span
            className="ml-3 text-[10px]"
            style={{ color: "var(--brand-text-muted)" }}
          >
            {content.footerText}
          </span>
        )}
      </div>
    </div>
  )
}
