import type { Metadata } from "next";
import { buildPublicUrl, PUBLIC_SITE_NAME } from "@/lib/seo/public-site";
import { getPublicBuildsMode } from "@/lib/public-builds/constants";
import { RoleBuilder } from "./role-builder";
import { wallFontVariables } from "../wall-fonts";
import "../wall.css";

export const metadata: Metadata = {
  title: `Role Builder — ${PUBLIC_SITE_NAME}`,
  description:
    "Paste a position description and watch the platform read the role, weigh the capability library against it, and build a role-specific assessment.",
  alternates: { canonical: buildPublicUrl("/build") },
};

export default function BuildPage() {
  // The wall's type (Caslon, Courier Prime) is bound to CSS variables by
  // next/font; without this wrapper `--display`/`--serif`/`--mono` are empty
  // here and every screen falls back to the root layout's sans.
  return (
    <div className={wallFontVariables}>
      <RoleBuilder inviteRequired={getPublicBuildsMode() === "closed"} />
    </div>
  );
}
