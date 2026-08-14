import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// =============================================================================
// Type stack — self-hosted, no build-time network
// =============================================================================
//
// Fonts are vendored into `src/app/fonts/` and loaded with `next/font/local`
// rather than `next/font/google`. The Google CDN intermittently 404s the
// hashed woff2 URLs at build time, which takes the whole build down; nothing
// here reaches the network. The .woff2 files are byte-for-byte the files
// Google serves for these exact requests, so rendering is unchanged.
// Re-vendor with `scripts/vendor-fonts.mjs` if a face changes.
//
// SUBSETS VENDORED: latin, latin-ext (all three families, both styles).
//
// latin-ext is not optional. This is a hiring platform and candidate/client
// names are largely European: without it `Wałęsa`, `Ștefan`, `Kovačević` and
// `Krišjānis` render half in the real face and half in metric-adjusted Arial,
// breaking mid-name. It costs 122,836 bytes and is worth every one.
//
// SUBSETS DELIBERATELY DROPPED, and what each would cost if you add it back
// (measured across all six loader calls, unique files only):
//   vietnamese    43,456 bytes   cyrillic-ext  44,376 bytes
//   cyrillic      84,268 bytes   greek         40,592 bytes
//   symbols2       5,892 bytes
// `next/font/google` used to download all of these and preload only latin.
// Dropping them is a product decision, not an oversight — text outside the
// vendored ranges falls back to the metric-adjusted fallback face below.
//
// WHY EACH FAMILY IS TWO CALLS — read before editing:
//
// Google ships one file per subset, so latin and latin-ext are separate woff2s
// that must end up under ONE font-family, otherwise the metric-adjusted
// fallback below sits between them and every latin-ext character renders in
// Arial anyway. Merging them relies on two next/font behaviours:
//
//   * The generated @font-face family name is the BINDING NAME of the call
//     (`const plusJakarta` -> `font-family: plusJakarta`), unless
//     `declarations` sets `font-family` explicitly.
//   * The CSS variable's value is ALWAYS derived from the binding name, even
//     when `declarations` overrides the face family. (Under Turbopack those
//     two can therefore disagree — which is exactly the trap: setting
//     `font-family` on the variable-owning call silently points --font-sans at
//     a family with no faces.)
//
// So: the latin call owns the CSS variable and takes its family from its
// binding name, and the latin-ext call pins `font-family` in `declarations` to
// that same binding name. THE STRING IN THE EXT CALL'S `declarations` MUST
// MATCH THE `const` NAME OF THE LATIN CALL BELOW IT. Rename one, rename both.
//
// `unicode-range` is mandatory, not decoration: two @font-face rules sharing a
// family, weight and style have identical matching descriptors and the later
// one silently shadows the earlier. The ranges are Google's own, verbatim —
// run `scripts/vendor-fonts.mjs` to re-print them.
//
// The latin-ext calls also set `preload: false` (matching Google, which only
// preloaded latin) and `adjustFontFallback: false` so only the latin call
// emits the metric-adjusted fallback face, with metrics from the latin file.
// Their `--*-ext` variables are inert artefacts — they exist only so the
// binding is referenced. Do not consume them, do not "tidy" them away.

// Both faces are variable fonts — one file per subset spans the whole weight
// range (all weights true-rendered) instead of five (Jakarta) + three
// (Geist Mono) static cuts.
const plusJakartaLatinExt = localFont({
  src: [
    {
      path: "./fonts/plus-jakarta-sans-latin-ext-variable.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
  variable: "--font-sans-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "plusJakarta" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const plusJakarta = localFont({
  src: [
    {
      path: "./fonts/plus-jakarta-sans-latin-variable.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const geistMonoLatinExt = localFont({
  src: [
    {
      path: "./fonts/geist-mono-latin-ext-variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-mono-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "geistMono" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const geistMono = localFont({
  src: [
    {
      path: "./fonts/geist-mono-latin-variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const sourceSerifLatinExt = localFont({
  src: [
    { path: "./fonts/source-serif-4-latin-ext-variable.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source-serif-4-latin-ext-variable.woff2", weight: "600", style: "normal" },
    {
      path: "./fonts/source-serif-4-latin-ext-variable-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/source-serif-4-latin-ext-variable-italic.woff2",
      weight: "600",
      style: "italic",
    },
  ],
  variable: "--font-serif-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "sourceSerif" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const sourceSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-latin-variable.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source-serif-4-latin-variable.woff2", weight: "600", style: "normal" },
    // Italic 400 carries the SJT scenario text in the assessment runner.
    { path: "./fonts/source-serif-4-latin-variable-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/source-serif-4-latin-variable-italic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const metadata: Metadata = {
  title: "Trajectas",
  description: "Psychometric Assessment & Client Diagnostic Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaLatinExt.variable} ${plusJakarta.variable} ${geistMonoLatinExt.variable} ${geistMono.variable} ${sourceSerifLatinExt.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
