import type { MetadataRoute } from "next";
import { buildPublicUrl } from "@/lib/seo/public-site";

const MARKETING_ROUTES = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/psychometric-assessment",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/capability-assessment",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/performance-and-outcomes",
    changeFrequency: "monthly",
    priority: 0.75,
  },
] as const satisfies Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return MARKETING_ROUTES.map((route) => ({
    url: buildPublicUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
