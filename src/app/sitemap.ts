import type { MetadataRoute } from "next";
import { MARKETING_ROUTES } from "@/lib/seo/marketing-routes";
import { buildPublicUrl } from "@/lib/seo/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return MARKETING_ROUTES.flatMap(({ path, sitemap: entry }) =>
    entry
      ? [
          {
            url: buildPublicUrl(path),
            lastModified,
            changeFrequency: entry.changeFrequency,
            priority: entry.priority,
          },
        ]
      : []
  );
}
