import { cn } from "@/lib/utils";
import { WORDMARK_PATH, WORDMARK_WIDTH } from "@/lib/brand/wordmark-path";

export type TrajectasLogoVariant = "mark" | "horizontal" | "stacked" | "wordmark";

interface TrajectasLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TrajectasLogoVariant;
  /** White wordmark and Span, with the gold accent, for dark grounds. */
  light?: boolean;
  /** Use the assessment runner's light/dark logo tokens. */
  runner?: boolean;
  gold?: boolean;
  height?: number;
  title?: string;
}

/** Approved identity: lowercase trajectas, no full stop, with the original Span. */
export function TrajectasLogo({
  variant = "mark",
  light = false,
  runner = false,
  gold = true,
  height = 32,
  className,
  title = "Trajectas",
  style,
  ...rest
}: TrajectasLogoProps) {
  const primary = runner ? "var(--runner-logo-mark, #2d6a5a)" : light ? "#ffffff" : "#2d6a5a";
  const ink = runner ? "var(--runner-logo-wordmark, #1a1a1a)" : light ? "#ffffff" : "#1a1a1a";
  const accent = gold ? "#c9a962" : primary;
  const width = variant === "mark" ? 64 : variant === "stacked" ? 120 : WORDMARK_WIDTH + (variant === "horizontal" ? 49 : 0);
  const viewHeight = variant === "mark" ? 64 : variant === "stacked" ? 106 : 40;
  const wordTransform = variant === "stacked"
    ? `translate(${(120 - WORDMARK_WIDTH * .7) / 2} 94) scale(.0238 -.0238)`
    : `translate(${variant === "horizontal" ? 49 : 0} 29) scale(.034 -.034)`;

  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={cn("inline-flex shrink-0 items-center align-middle", className)}
      style={{ height, ...style }}
      {...rest}
    >
      <svg
        viewBox={`0 0 ${width} ${viewHeight}`}
        width={width / viewHeight * height}
        height={height}
        aria-hidden="true"
        focusable="false"
        style={{ display: "block", height, width: "auto" }}
      >
        {variant !== "wordmark" && (
          <g transform={variant === "horizontal" ? "scale(.625)" : variant === "stacked" ? "translate(28 0)" : undefined}>
            <rect x="9" y="46" width="7" height="10" rx="3.5" fill={primary} />
            <rect x="22" y="36" width="7" height="20" rx="3.5" fill={primary} />
            <rect x="35" y="24" width="7" height="32" rx="3.5" fill={primary} />
            <rect x="48" y="10" width="7" height="46" rx="3.5" fill={accent} />
          </g>
        )}
        {variant !== "mark" && <path d={WORDMARK_PATH} transform={wordTransform} fill={ink} />}
      </svg>
    </span>
  );
}
