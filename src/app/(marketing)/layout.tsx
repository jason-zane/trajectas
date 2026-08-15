import type { Metadata } from "next";
import localFont from "next/font/local";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_TAGLINE,
  getPublicSiteMetadataBase,
} from "@/lib/seo/public-site";
import "./globals-marketing.css";

// Vendored latin + latin-ext subset files — see the block comment in
// `src/app/layout.tsx` for why each family is two calls, and why the ext
// call's `declarations` font-family must match the latin call's `const` name.
// One @font-face per weight, pinned off the same variable file, mirrors what
// Google Fonts served here.
//
// Bindings are `marketingDisplay` / `marketingMono`, not `plusJakarta` /
// `geistMono`: the binding name becomes the @font-face family, and the root
// layout (which wraps this one) already owns those two names with a different
// set of weights. Distinct names keep the two sets in separate families.
const marketingDisplayLatinExt = localFont({
  src: [
    { path: "../fonts/plus-jakarta-sans-latin-ext-variable.woff2", weight: "400", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-ext-variable.woff2", weight: "500", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-ext-variable.woff2", weight: "600", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-ext-variable.woff2", weight: "700", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-ext-variable.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "marketingDisplay" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const marketingDisplay = localFont({
  src: [
    { path: "../fonts/plus-jakarta-sans-latin-variable.woff2", weight: "400", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-variable.woff2", weight: "500", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-variable.woff2", weight: "600", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-variable.woff2", weight: "700", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-variable.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const marketingMonoLatinExt = localFont({
  src: [
    { path: "../fonts/geist-mono-latin-ext-variable.woff2", weight: "300", style: "normal" },
    { path: "../fonts/geist-mono-latin-ext-variable.woff2", weight: "400", style: "normal" },
    { path: "../fonts/geist-mono-latin-ext-variable.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "marketingMono" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const marketingMono = localFont({
  src: [
    { path: "../fonts/geist-mono-latin-variable.woff2", weight: "300", style: "normal" },
    { path: "../fonts/geist-mono-latin-variable.woff2", weight: "400", style: "normal" },
    { path: "../fonts/geist-mono-latin-variable.woff2", weight: "500", style: "normal" },
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

export const metadata: Metadata = {
  metadataBase: getPublicSiteMetadataBase(),
  title: {
    default: `${PUBLIC_SITE_NAME} — ${PUBLIC_SITE_TAGLINE}`,
    template: "%s",
  },
  description: PUBLIC_SITE_DESCRIPTION,
  keywords: [...MARKETING_KEYWORDS],
  applicationName: PUBLIC_SITE_NAME,
  authors: [{ name: PUBLIC_SITE_NAME }],
  creator: PUBLIC_SITE_NAME,
  publisher: PUBLIC_SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-surface="marketing"
      className={`${marketingDisplayLatinExt.variable} ${marketingDisplay.variable} ${marketingMonoLatinExt.variable} ${marketingMono.variable}`}
    >
      {children}
    </div>
  );
}
