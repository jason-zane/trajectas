import type { MetadataRoute } from "next";
import { buildPublicUrl, getPublicSiteUrl } from "@/lib/seo/public-site";

const PRIVATE_PATHS = [
  "/api/",
  "/auth/",
  "/login",
  "/logout",
  "/assess/",
  "/client/",
  "/partner/",
  "/preview/",
  "/surface-coming-soon",
  "/unauthorized",
  "/dashboard",
  "/users",
  "/participants",
  "/assessments",
  "/reports",
  "/matching",
  "/clients",
  "/partners",
  "/profile",
  "/psychometrics",
  "/settings",
  "/directory",
  "/factors",
  "/response-formats",
  "/chat",
  "/constructs",
  "/dimensions",
  "/report-templates",
  "/diagnostics",
  "/campaigns",
  "/items",
  "/generate",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PATHS],
    },
    sitemap: buildPublicUrl("/sitemap.xml"),
    host: getPublicSiteUrl(),
  };
}
