import type { Metadata } from "next";
import { buildPublicUrl, PUBLIC_SITE_NAME } from "@/lib/seo/public-site";
import { RoleBuilder } from "./role-builder";
import "../wall.css";

export const metadata: Metadata = {
  title: `Role Builder — ${PUBLIC_SITE_NAME}`,
  description:
    "Paste a position description and watch the platform read the role, weigh the capability library against it, and build a role-specific assessment.",
  alternates: { canonical: buildPublicUrl("/build") },
};

export default function BuildPage() {
  return <RoleBuilder />;
}
