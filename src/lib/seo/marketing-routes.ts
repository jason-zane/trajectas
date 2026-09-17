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
  {
    path: "/psychometric-assessment",
    sitemap: { changeFrequency: "monthly", priority: 0.8 },
  },
  {
    path: "/capability-assessment",
    sitemap: { changeFrequency: "monthly", priority: 0.8 },
  },
  {
    path: "/performance-and-outcomes",
    sitemap: { changeFrequency: "monthly", priority: 0.75 },
  },
  // The archived cinematic home. It is noindex, not private: its canonical
  // and Open Graph URLs point at the public host, and its Cal.com embed needs
  // the public-surface CSP.
  { path: "/classic", sitemap: null },
] as const satisfies ReadonlyArray<{
  path: `/${string}`;
  sitemap: SitemapEntry | null;
}>;

export const MARKETING_PATHS: ReadonlySet<string> = new Set(
  MARKETING_ROUTES.map((route) => route.path)
);
