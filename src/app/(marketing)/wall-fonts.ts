import localFont from "next/font/local";

// =============================================================================
// The Panel's Wall — type stack, self-hosted, no build-time network.
//
// Fonts are vendored into `src/app/fonts/` and loaded with `next/font/local`
// (see the block comment in `src/app/layout.tsx` for why: the Google CDN
// intermittently 404s the hashed woff2 URLs at build time). Shared by
// `/build` and the home page (src/app/(marketing)/page.tsx) — both live in
// the Panel's Wall design world (src/app/(marketing)/DESIGN.md).
//
// SUBSETS VENDORED: latin, latin-ext, same rationale as the root layout's
// stack — this is a hiring platform and names are largely European.
//
// WHY EACH FAMILY IS TWO localFont CALLS: see the long comment in
// src/app/layout.tsx. Short version — the latin call owns the CSS variable
// and takes its family from its binding name; the latin-ext call pins
// `declarations[0].value` to that same binding name string. Rename one,
// rename both. `unicode-range` is mandatory (two @font-face rules with
// identical weight/style/family otherwise shadow each other).
//
// The wordmark stays on Plus Jakarta Sans, already loaded globally by the
// root layout as `--font-sans` — no separate load here.
// =============================================================================

const LATIN_EXT_RANGE =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";
const LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const wallDisplayExt = localFont({
  src: [{ path: "../fonts/libre-caslon-display-latin-ext-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-wall-display-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "wallDisplay" },
    { prop: "unicode-range", value: LATIN_EXT_RANGE },
  ],
});

const wallDisplay = localFont({
  src: [{ path: "../fonts/libre-caslon-display-latin-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-wall-display",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: LATIN_RANGE }],
});

const wallTextExt = localFont({
  src: [
    { path: "../fonts/libre-caslon-text-latin-ext-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/libre-caslon-text-latin-ext-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/libre-caslon-text-latin-ext-italic-400.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-wall-text-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "wallText" },
    { prop: "unicode-range", value: LATIN_EXT_RANGE },
  ],
});

const wallText = localFont({
  src: [
    { path: "../fonts/libre-caslon-text-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/libre-caslon-text-latin-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/libre-caslon-text-latin-italic-400.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-wall-text",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: LATIN_RANGE }],
});

const wallMonoExt = localFont({
  src: [
    { path: "../fonts/courier-prime-latin-ext-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/courier-prime-latin-ext-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-wall-mono-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "wallMono" },
    { prop: "unicode-range", value: LATIN_EXT_RANGE },
  ],
});

const wallMono = localFont({
  src: [
    { path: "../fonts/courier-prime-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/courier-prime-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-wall-mono",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: LATIN_RANGE }],
});

/** Apply on the outermost `.wall` element so wall.css's font variables resolve. */
export const wallFontVariables = [
  wallDisplayExt.variable,
  wallDisplay.variable,
  wallTextExt.variable,
  wallText.variable,
  wallMonoExt.variable,
  wallMono.variable,
].join(" ");
