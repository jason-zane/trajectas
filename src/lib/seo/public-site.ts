import { requireAppUrl } from "@/lib/hosts";

export const PUBLIC_SITE_NAME = "Trajectas";

export const PUBLIC_SITE_TAGLINE = "Capabilities, contextualised.";

export const PUBLIC_SITE_DESCRIPTION =
  "Trajectas builds psychometric instruments around the capabilities your organisation actually needs, with measurement tied to the outcomes you're trying to move.";

export const MARKETING_KEYWORDS = [
  "psychometric assessment",
  "contextual psychometric assessment",
  "capability assessment",
  "organisational capability assessment",
  "role-based capability assessment",
  "custom capability framework",
  "capability measurement",
  "competency assessment",
  "leadership capability assessment",
  "hiring capability assessment",
  "succession capability assessment",
  "behavioural assessment",
  "outcome-tied assessment",
  "performance prediction",
  "capability and performance",
  "trajectory assessment",
  "capability mapping",
  "calibrated psychometric items",
  "organisational psychology assessment",
  "industrial organisational psychology",
  "workforce capability measurement",
  "assessment built around your context",
  "alternative to SHL",
  "alternative to Korn Ferry",
  "alternative to Predictive Index",
] as const;

/** OG title used when individual pages don't supply one. */
export const PUBLIC_SITE_OG_TITLE = `${PUBLIC_SITE_NAME} — ${PUBLIC_SITE_TAGLINE}`;

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
