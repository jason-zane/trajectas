import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PUBLIC_SITE_NAME, buildPublicUrl } from "@/lib/seo/public-site";
import { getPublicBuildsMode } from "@/lib/public-builds/constants";
import { PublicHeader, PublicFooter } from "./components/public-header";
import { RoleExample } from "./components/role-example";
import "./public-experience.css";

/* THESIS: Make role-to-capability matching understandable before asking for effort.
OWN-WORLD: White, mineral grey, emerald actions, restrained gold, precise sans typography.
STORY: Understand the mechanism, review an example, try it with your own role.
FIRST VIEWPORT: Left-aligned statement above a wide working example and assessment summary.
FORM: User-selected first concept; semantic product evidence replaces decorative illustration. */
const title = `${PUBLIC_SITE_NAME} — Capabilities, contextualised`;
const description =
  "Trajectas helps organisations understand the people they depend on. We build psychometric instruments around the capabilities your organisation actually needs, with measurement tied to the outcomes you're trying to move.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: buildPublicUrl("/"),
    siteName: PUBLIC_SITE_NAME,
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@trajectas",
    site: "@trajectas",
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PUBLIC_SITE_NAME,
    alternateName: "Trajectas Assessment",
    url: buildPublicUrl("/"),
    logo: buildPublicUrl("/brand/span-lockup-horizontal.svg"),
    description,
    foundingDate: "2026",
    sameAs: ["https://www.linkedin.com/company/trajectas"],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: "hello@trajectas.com",
        availableLanguage: ["en-AU", "en"],
        areaServed: ["AU", "APAC", "EU", "UK", "NA"],
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PUBLIC_SITE_NAME,
    url: buildPublicUrl("/"),
    description,
    inLanguage: "en-AU",
  },
];


const steps = [
  ["Describe the role", "Paste a position description or upload a document. Include the responsibilities and context that matter."],
  ["Review the capabilities", "See what the role calls for and why. Adjust the recommendations and the length of the assessment."],
  ["Experience the assessment", "Take it yourself, then receive your report. See how the experience could work for your organisation."],
];

export default function HomePage() {
  const mode = getPublicBuildsMode();
  return <div className="px-surface px-home" data-surface="public-experience">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <PublicHeader />
    <main id="main-content">
      <section className="px-container px-hero">
        <p className="px-kicker">Capabilities, contextualised.</p>
        <div className="px-hero-heading"><h1>Every role is different.<br /><span>Measure what matters.</span></h1><p className="px-hero-aside">A clearer understanding of people starts with the work they need to do.</p></div>
        <p className="px-hero-lede">Turn a position description into a focused capability assessment.</p>
        <div className="px-actions"><Link href="/build" className="px-button">Build a role assessment <ArrowRight size={18} aria-hidden /></Link><a href="#how-it-works" className="px-link">See how it works <ArrowRight size={17} aria-hidden /></a></div>
        <p className="px-hero-note">Free to try · One person · Your report by email{mode === "closed" ? " · Invitation required during preview" : mode === "off" ? " · Preview currently paused" : ""}</p>
        <RoleExample />
      </section>
      <section id="how-it-works" className="px-process"><div className="px-container"><div className="px-section-heading"><p className="px-label">From role to report</p><h2>Relevant from the start.<br />Clear at every step.</h2></div><ol className="px-process-list">{steps.map(([heading, body], i) => <li key={heading}><span className="px-step-number">0{i + 1}</span><h3>{heading}</h3><p>{body}</p></li>)}</ol></div></section>
      <section id="for-teams" className="px-container px-teams"><div><p className="px-label">For organisations and partners</p><h2>Start with a role.<br />Build a wider picture.</h2><p>The Role Builder lets you experience Trajectas for yourself. For work across your organisation or your clients, we help you connect capability, business outcomes and growth over time.</p><a href="/contact" className="px-link">Talk about your organisation <ArrowUpRight size={18} aria-hidden /></a></div><div className="px-audience-list"><article><h3>HR and talent teams</h3><p>Bring role context to selection, development and succession decisions.</p></article><article><h3>Consultancies and search firms</h3><p>Run assessment programmes for your clients through a dedicated partner workspace.</p></article><a href="/for-teams" className="px-link">Explore Trajectas for teams <ArrowRight size={17} aria-hidden /></a></div></section>
      <section className="px-container px-questions" aria-labelledby="questions-title"><h2 id="questions-title">Before you try it</h2><div>
        <details><summary>What can I do with the free assessment?</summary><p>Build an assessment for one role, take it yourself and receive a report by email. It is a way to experience the process. For assessments with your team or participants, get in touch.</p></details>
        <details><summary>How long will it take?</summary><p>You can choose 4–8 capabilities, with six questions each: roughly 5–10 minutes to complete. You will see the exact question count and estimated time before creating your assessment.</p></details>
        <details><summary>What do I need to get started?</summary><p>A role title and a position description, as text, PDF or Word document. We verify your email before processing the role.{mode === "closed" && <> During preview, you also need an invitation code. <a href="/contact">Ask us for one.</a></>}</p></details>
      </div></section>
      <section className="px-container px-close"><h2>Bring a role.<br />See what it calls for.</h2><Link href="/build" className="px-button">Build a role assessment <ArrowRight size={18} aria-hidden /></Link></section>
    </main><PublicFooter />
  </div>;
}
