import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicUrl, PUBLIC_SITE_NAME } from "@/lib/seo/public-site";
import { getPublicBuildsMode } from "@/lib/public-builds/constants";
import { getPublicBuildSession } from "@/app/actions/public-builds-session";
import { RoleBuilder } from "./role-builder";
import { BuilderFrame, BuilderHeading } from "./builder-frame";
import "../public-experience.css";

export const metadata: Metadata = {
  title: `Role Builder — ${PUBLIC_SITE_NAME}`,
  description: "Turn a position description into a focused capability assessment. Review the recommendations, take it yourself and receive your report.",
  alternates: { canonical: buildPublicUrl("/build") },
};

export default async function BuildPage() {
  const mode = getPublicBuildsMode();
  if (mode === "off") return <BuilderFrame step={0}><div className="rb-ready"><BuilderHeading title="The Role Builder is taking a pause.">The preview is currently unavailable. Get in touch and we’ll help you explore an assessment for your role.</BuilderHeading><div className="px-actions"><a href="mailto:hello@trajectas.com" className="px-button">Talk to Trajectas</a><Link href="/" className="px-link">Back to home</Link></div></div></BuilderFrame>;
  const session = await getPublicBuildSession();
  return <RoleBuilder inviteRequired={mode === "closed"} initialSession={"error" in session ? { email: null, build: null } : session} initialError={"error" in session ? session.error : undefined} />;
}
