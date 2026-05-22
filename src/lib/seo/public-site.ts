import { requireAppUrl } from "@/lib/hosts";

export const PUBLIC_SITE_NAME = "Trajectas";

export const MARKETING_KEYWORDS = [
  "psychometric assessment",
  "capability assessment",
  "contextual psychometric assessment",
  "organisational capability assessment",
  "performance assessment",
  "capability and performance",
  "assessment outcomes",
  "custom assessment design",
  "assessment built around your context",
  "workforce capability measurement",
] as const;

export function getPublicSiteUrl(): string {
  return requireAppUrl("public");
}

export function getPublicSiteMetadataBase(): URL {
  return new URL(getPublicSiteUrl());
}

export function buildPublicUrl(pathname = "/"): string {
  return new URL(pathname, getPublicSiteUrl()).toString();
}

export function createWebPageJsonLd(input: {
  path: string;
  name: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url: buildPublicUrl(input.path),
    isPartOf: {
      "@type": "WebSite",
      name: PUBLIC_SITE_NAME,
      url: getPublicSiteUrl(),
    },
  };
}

export function createBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildPublicUrl(item.path),
    })),
  };
}
