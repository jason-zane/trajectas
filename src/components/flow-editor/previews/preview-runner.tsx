"use client"

import { TrajectasLogo } from "@/components/brand/trajectas-logo";

import type { RunnerContent } from "@/lib/experience/types"

interface PreviewRunnerProps {
  content: RunnerContent
}

export function PreviewRunner({ content }: PreviewRunnerProps) {
  return (
    <div
      className="flex flex-col min-h-[400px] overflow-hidden"
      style={{
        borderRadius: "10px",
        background: "var(--runner-page)",
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* Hairline progress bar (2px) at top */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: "var(--runner-hairline)" }}
      >
        <div
          className="h-full"
          style={{
            width: "40%",
            backgroundColor: "var(--runner-progress)",
            transition: "width 0.3s ease-out",
          }}
        />
      </div>

      {/* Header with brand + back button */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid var(--runner-hairline)` }}
      >
        <TrajectasLogo variant="horizontal" runner height={26} />
        <button
          type="button"
          className="text-[10px] transition-colors"
          style={{ color: "var(--runner-text-muted)" }}
        >
          {content.backButtonLabel}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 space-y-5">
        {/* Assessment name eyebrow */}
        <p
          className="text-[0.75rem] font-semibold uppercase tracking-[0.16em]"
          style={{
            color: "var(--runner-overline)",
            fontFamily: '"Geist Mono", monospace',
            letterSpacing: "0.16em",
          }}
        >
          Assessment Name
        </p>

        {/* Mock question card */}
        <div className="space-y-4">
          <p
            className="text-base leading-relaxed"
            style={{
              color: "var(--runner-display)",
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontWeight: 600,
            }}
          >
            I enjoy working collaboratively with others to solve problems.
          </p>

          {/* Mock likert options (5-column grid) */}
          <div className="grid grid-cols-5 gap-2">
            {["SD", "D", "N", "A", "SA"].map((label, i) => {
              const isSelected = i === 3
              return (
                <button
                  key={label}
                  type="button"
                  className="py-2 px-1 text-[9px] font-medium text-center transition-all duration-150"
                  style={{
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: isSelected
                      ? "var(--runner-selected-fill)"
                      : "var(--runner-ghost-border)",
                    backgroundColor: isSelected
                      ? "var(--runner-selected-fill)"
                      : "var(--runner-ghost-fill)",
                    color: isSelected
                      ? "var(--runner-selected-text)"
                      : "var(--runner-text)",
                    fontWeight: isSelected ? "600" : "500",
                    boxShadow: isSelected ? "var(--runner-selected-shadow)" : "none",
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer with save status */}
      <div
        className="flex items-center justify-center gap-1.5 px-6 py-3"
        style={{
          borderTop: `1px solid var(--runner-hairline)`,
          color: "var(--runner-text-muted)",
          fontSize: "0.6875rem",
        }}
      >
        <span
          className="inline-block size-1.5 rounded-full"
          style={{ backgroundColor: "var(--runner-save-dot)" }}
        />
        <span>{content.saveStatusIdle}</span>
        {content.footerText && (
          <span className="ml-3">{content.footerText}</span>
        )}
      </div>
    </div>
  )
}
