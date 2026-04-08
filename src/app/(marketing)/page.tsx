import type { Metadata } from "next";
import { MarketingPageClient } from "./marketing-page-client";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_NAME,
  buildPublicUrl,
} from "@/lib/seo/public-site";

const title =
  "Psychometric Assessment for Capability, Performance, and Outcomes | Trajectas";
const description =
  "Trajectas builds contextual psychometric assessment around your organisation, your capability model, and the performance outcomes you need to measure.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [...MARKETING_KEYWORDS],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: buildPublicUrl("/"),
    siteName: PUBLIC_SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const homeStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PUBLIC_SITE_NAME,
    url: buildPublicUrl("/"),
    description,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PUBLIC_SITE_NAME,
    url: buildPublicUrl("/"),
    description,
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Psychometric assessment",
    name: "Contextual psychometric assessment",
    provider: {
      "@type": "Organization",
      name: PUBLIC_SITE_NAME,
      url: buildPublicUrl("/"),
    },
    areaServed: "Global",
    description:
      "Custom psychometric assessment designed around organisational context, capability, performance, and outcomes.",
  },
];

export default function MarketingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeStructuredData),
        }}
      />
      <MarketingPageClient />
    </>
  );
}
