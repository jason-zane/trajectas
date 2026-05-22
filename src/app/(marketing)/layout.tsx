import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_TAGLINE,
  getPublicSiteMetadataBase,
} from "@/lib/seo/public-site";
import "./globals-marketing.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono",
  display: "swap",
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
      className={`${plusJakarta.variable} ${geistMono.variable}`}
    >
      {children}
    </div>
  );
}
