import type { MetadataRoute } from "next";

type SitemapEntry = {
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

/**
 * Every page under `src/app/(marketing)`. This list is the single source for
 * both the sitemap and the proxy's public-host allowlist: the proxy redirects
 * any page path it doesn't recognise on the public host to the admin host, so
 * a marketing page missing from here is served from admin.* instead — noindex,
 * with the admin CSP, and unreachable from the URL the sitemap advertises.
 *
 * `sitemap: null` keeps a page on the public host without advertising it.
 */
export const MARKETING_ROUTES = [
  { path: "/", sitemap: { changeFrequency: "weekly", priority: 1 } },
  { path: "/how-it-works", sitemap: { changeFrequency: "monthly", priority: 0.8 } },
  { path: "/for-teams", sitemap: { changeFrequency: "monthly", priority: 0.8 } },
  { path: "/contact", sitemap: { changeFrequency: "monthly", priority: 0.7 } },
  { path: "/capability-model", sitemap: { changeFrequency: "weekly", priority: 0.8 } },
  { path: "/role-builder", sitemap: { changeFrequency: "monthly", priority: 0.9 } },
  // The verified, invitation-gated Role Builder workflow.
  { path: "/build", sitemap: { changeFrequency: "weekly", priority: 0.9 } },
  {
    path: "/psychometric-assessment",
    sitemap: null,
  },
  {
    path: "/capability-assessment",
    sitemap: null,
  },
  {
    path: "/performance-and-outcomes",
    sitemap: null,
  },
  // Retired URLs stay allowed on the public host so their redirects resolve.
  { path: "/classic", sitemap: null },
] as const satisfies ReadonlyArray<{
  path: `/${string}`;
  sitemap: SitemapEntry | null;
}>;

export const MARKETING_PATHS: ReadonlySet<string> = new Set(
  MARKETING_ROUTES.map((route) => route.path)
);
