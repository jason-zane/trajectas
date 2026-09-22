import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PUBLIC_SITE_NAME, buildPublicUrl } from "@/lib/seo/public-site";
import { PublicHeader, PublicFooter } from "./components/public-header";
import { PlatformExample } from "./components/platform-example";
import "./public-experience.css";
import "./platform-home.css";

/* THESIS: Introduce the wider capability-assessment platform, with Role Builder as
an accessible first experience rather than the whole product story.
OWN-WORLD: Approved warm paper, sage, emerald and gold; precise sans typography.
STORY: Understand the platform, see its relevance, explore Role Builder or contact us.
FIRST VIEWPORT: Broad platform statement and primary CTA left; a concrete, illustrative
selection/development/growth example right. Context and evidence stay connected.
FORM: The user-requested conventional platform landing page overrides a new identity
exercise. Preserve the approved visual system and move the full role demo to its own route. */
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


export default function HomePage() {
  return <div className="px-surface px-home ph-home" data-surface="public-experience">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <PublicHeader />
    <main id="main-content">
      <section className="px-container ph-hero">
        <div className="ph-hero-copy">
          <p className="px-kicker">The capability assessment platform</p>
          <h1>Understanding people<br /><span>is the real work.</span></h1>
          <p className="ph-lede">Bring a clearer picture of capability to your people decisions.</p>
          <p className="ph-hero-body">Trajectas connects assessment with the work people do — helping organisations and partners shape selection, development and growth.</p>
          <div className="px-actions"><Link href="/role-builder" className="px-button">Explore Role Builder <ArrowRight size={18} aria-hidden /></Link><Link href="/contact" className="px-link">Talk to us <ArrowUpRight size={17} aria-hidden /></Link></div>
          <p className="ph-hero-note">See the approach in action with a role you know.</p>
        </div>
        <PlatformExample />
      </section>
      <section className="ph-context-strip" aria-label="Who Trajectas is for"><div className="px-container"><p>Built for the people<br /><strong>behind people decisions.</strong></p><span>HR &amp; talent teams</span><span>Consultancies &amp; advisers</span><span>Search &amp; selection firms</span></div></section>
      <section className="px-container ph-platform" id="platform">
        <div className="ph-section-intro"><div><p className="px-kicker">A connected approach</p><h2>From the work that matters<br />to the people doing it.</h2></div><p>An assessment becomes more useful when the capabilities, the context and the decision belong together.</p></div>
        <div className="ph-method">
          <article><span className="ph-method-label">Context</span><h3>Start with the work.</h3><p>Understand what a role calls for: its responsibilities, challenges and the outcomes you want to support.</p><Link className="px-link" href="/how-it-works">See the approach <ArrowRight size={16} aria-hidden /></Link></article>
          <article><span className="ph-method-label">Capability</span><h3>Make assessment relevant.</h3><p>Bring together capabilities from a shared library, with clear definitions and behavioural indicators.</p><Link className="px-link" href="/capability-model">Explore the model <ArrowRight size={16} aria-hidden /></Link></article>
          <article><span className="ph-method-label">Understanding</span><h3>Put evidence to work.</h3><p>Use assessment reports alongside role context and other evidence to guide decisions and development conversations.</p><Link className="px-link" href="/for-teams">Explore it for your team <ArrowRight size={16} aria-hidden /></Link></article>
        </div>
      </section>
      <section className="ph-try" aria-labelledby="try-title"><div className="px-container ph-try-inner">
        <div><p className="px-kicker">Experience the approach</p><h2 id="try-title">Start with a role.<br />See the difference<br />context makes.</h2><p>Role Builder is a hands-on introduction to Trajectas. Bring a position description, explore the relevant capabilities and try an assessment for yourself.</p><Link href="/role-builder" className="px-button">Discover Role Builder <ArrowRight size={18} aria-hidden /></Link><span className="ph-try-note">A one-person experience. A starting point for a bigger conversation.</span></div>
        <div className="ph-try-preview"><div className="ph-preview-heading"><span>Role Builder</span><span>Illustrative example</span></div><h3>Operations Manager</h3><p>Coordinate teams. Improve delivery.<br />Make decisions under pressure.</p><div className="ph-preview-capabilities"><span>Judgement</span><span>Organisation</span><span>Collaboration</span></div><div className="ph-preview-flow"><span>Your role</span><ArrowRight size={16} aria-hidden /><span>Capabilities</span><ArrowRight size={16} aria-hidden /><span>Assessment</span></div><p className="ph-preview-note">A few capabilities a role might draw on. Review the fuller example in Role Builder.</p></div>
      </div></section>
      <section className="px-container ph-audiences"><div className="ph-section-intro"><h2>For your organisation.<br />For the clients you support.</h2><p>Bring the same capability language to different programmes, roles and working relationships.</p></div><div className="ph-audience-columns"><article><p className="ph-audience-label">Organisations</p><h3>Make the next people decision<br />a more informed one.</h3><p>Connect assessment with selection, development and succession. Start with the decisions your team needs to make and build the programme around them.</p><Link className="px-link" href="/for-teams">Trajectas for teams <ArrowUpRight size={17} aria-hidden /></Link></article><article><p className="ph-audience-label">Partners</p><h3>Bring a clearer capability picture<br />to your client work.</h3><p>Run assessment programmes through a dedicated partner workspace, with client context, participant delivery and reporting kept together.</p><Link className="px-link" href="/contact?topic=partner">Talk about a partnership <ArrowUpRight size={17} aria-hidden /></Link></article></div></section>
      <section className="px-container px-close ph-close"><div><h2>What would a clearer picture<br />help you do?</h2><p>Tell us about your roles, your people and the decisions ahead.</p></div><Link className="px-button" href="/contact">Let’s talk <ArrowRight size={18} aria-hidden /></Link></section>
    </main><PublicFooter />
  </div>;
}
