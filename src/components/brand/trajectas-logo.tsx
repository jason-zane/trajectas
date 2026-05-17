import { cn } from "@/lib/utils";

type Variant = "mark" | "horizontal" | "stacked" | "wordmark";

interface TrajectasLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  /** Use the light treatment (white pills + white wordmark) for dark grounds. */
  light?: boolean;
  /** Mark-only variant: use the gold accent on the tallest pill. */
  gold?: boolean;
  /** Pixel height of the rendered logo. Width scales by the asset aspect ratio. */
  height?: number;
  title?: string;
}

function resolveSrc({
  variant,
  light,
  gold,
}: Required<Pick<TrajectasLogoProps, "variant" | "light" | "gold">>): string {
  switch (variant) {
    case "horizontal":
      return light
        ? "/brand/span-lockup-horizontal-light.svg"
        : "/brand/span-lockup-horizontal.svg";
    case "stacked":
      return light
        ? "/brand/span-lockup-stacked-light.svg"
        : "/brand/span-lockup-stacked.svg";
    case "wordmark":
      return light
        ? "/brand/span-wordmark-light.svg"
        : "/brand/span-wordmark.svg";
    case "mark":
    default:
      if (light) {
        return gold ? "/brand/span-mark-light-gold.svg" : "/brand/span-mark-light.svg";
      }
      return "/brand/span-mark.svg";
  }
}

/**
 * The Trajectas mark — the "Span" pills + wordmark in approved lockups.
 *
 * Honour the brand book: clear space = one pill width, sage + gold only,
 * never stretch, rotate, recolour, or add effects.
 */
export function TrajectasLogo({
  variant = "mark",
  light = false,
  gold = true,
  height = 32,
  className,
  title = "Trajectas",
  ...rest
}: TrajectasLogoProps) {
  const src = resolveSrc({ variant, light, gold });

  return (
    <span
      role="img"
      aria-label={title}
      className={cn("inline-flex items-center align-middle", className)}
      style={{ height }}
      {...rest}
    >
      {/* Plain <img> keeps the SVG inlined as text (preserves crisp scaling
          and avoids next/image priority cost for a tiny inline asset). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        height={height}
        style={{ height, width: "auto", display: "block" }}
        draggable={false}
      />
    </span>
  );
}
