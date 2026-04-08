import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_NAME,
  getPublicSiteMetadataBase,
} from "@/lib/seo/public-site";
import "./globals-marketing.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getPublicSiteMetadataBase(),
  title: {
    default: "Trajectas — Contextual Psychometric Assessment",
    template: "%s",
  },
  description:
    "Psychometric assessment built around organisational context, capability, performance, and measurable outcomes.",
  keywords: [...MARKETING_KEYWORDS],
  applicationName: PUBLIC_SITE_NAME,
  robots: {
    index: true,
    follow: true,
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
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      {children}
    </div>
  );
}
