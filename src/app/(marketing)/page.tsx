import type { Metadata } from "next";
import Link from "next/link";
import { TrajectasLogo } from "@/components/brand/trajectas-logo";
import { PUBLIC_SITE_NAME, buildPublicUrl } from "@/lib/seo/public-site";
import { getPublicLibraryCounts } from "@/lib/dal/public-library";
import { wallFontVariables } from "./wall-fonts";
import { HomePasteBox } from "./home-paste-box";
import "./wall.css";

// The library counts are queried at render time, never hard-coded
// (PRODUCT.md: "these numbers change ... must be queried at render time").
// force-dynamic also means this route's DB dependency is never a build-time
// (SSG) failure mode.
export const dynamic = "force-dynamic";

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

const CONTACT_EMAIL = "hello@trajectas.com";

/** Example selection: what this role turned on, drawn from the library index below. */
const CHOSEN = new Set(["Commercial Acumen", "Critical Analysis", "Judgement", "Decision Prioritisation", "Communication", "Influence"]);

const LIBRARY_INDEX = [
  "Analytical Thinking",
  "Commercial Acumen",
  "Execution",
  "Organisation",
  "Process Discipline",
  "Critical Analysis",
  "Decision Prioritisation",
  "Decisive Leadership",
  "Judgement",
  "Learning Agility",
  "Building Relationships",
  "Collaboration",
  "Communication",
  "Influence",
  "Interpersonal Sensitivity",
  "Achievement Drive",
  "Ingenuity",
  "People Development",
  "Performance Tenacity",
  "Strategic Vision",
  "Emotional Regulation",
  "Flexibility",
  "Resilience",
  "Self-Insight",
  "Visible Self-Development",
];

const ASSESSMENT_FACTORS = [
  { name: "Commercial Acumen", body: "Understands how the business makes and protects money, and uses that to shape decisions." },
  { name: "Critical Analysis", body: "Breaks complex problems into components to find causes, evidence, and what actually matters." },
  { name: "Judgement", body: "Makes sound decisions with the information available, even when the picture is incomplete." },
  { name: "Decision Prioritisation", body: "Puts attention on the decisions with the most impact and de-prioritises or delegates the rest." },
  { name: "Communication", body: "Conveys ideas with clarity, structure and economy, adapting register and medium to the audience." },
  { name: "Influence", body: "Moves others toward agreement by understanding their needs and finding paths between positions." },
];

const HOW_IT_WORKS = [
  { label: "First", title: "It reads the role.", body: "Title, level, function, the decisions the job owns, the context it sits in. What it understood is shown back to you, so a misread is caught early." },
  { label: "Then", title: "It weighs every capability against it.", body: "Each of the library's definitions is scored for how much this role turns on it, with the line of the description that says so." },
  { label: "Last", title: "It pins the few that matter. You can move them.", body: "Swap a close alternative in, take one out, and watch the length change. Then one click creates the assessment and sends you the link." },
];

const REPORT_ROWS = [
  { name: "Commercial Acumen", pct: 78, label: "High" },
  { name: "Critical Analysis", pct: 64, label: "Mid" },
  { name: "Judgement", pct: 71, label: "High" },
  { name: "Decision Prioritisation", pct: 46, label: "Mid" },
  { name: "Communication", pct: 58, label: "Mid" },
  { name: "Influence", pct: 33, label: "Low" },
];

export default async function HomePage() {
  const { capabilityCount, itemCount } = await getPublicLibraryCounts();

  return (
    <div className={`wall ${wallFontVariables}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
        <header className="flex items-center justify-between gap-4 py-6">
          <Link href="/" className="mark" aria-label={`${PUBLIC_SITE_NAME} home`}>
            <TrajectasLogo variant="horizontal" light height={22} />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-7">
            <a href="#method" className="on-baize-link hidden sm:inline">
              How it works
            </a>
            <Link href="/login" className="on-baize-link hidden sm:inline">
              Sign in
            </Link>
            <a className="tag relative" href={`mailto:${CONTACT_EMAIL}`}>
              <i className="pin" aria-hidden="true" />
              Talk to us
            </a>
          </nav>
        </header>

        {/* Display line + lede */}
        <section className="grid min-w-0 gap-10 pb-16 pt-6 lg:grid-cols-12 lg:items-end">
          <h1 className="display lg:col-span-7" style={{ fontSize: "clamp(2.75rem, 6vw, 4.5rem)" }}>
            Paste the role. We&rsquo;ll find the capabilities it turns on.
          </h1>
          <p className="lede lg:col-span-5" style={{ maxWidth: "44ch" }}>
            A short, role-specific assessment built from a position description: the few
            capabilities that matter for this job, measured properly, in about ten minutes.
          </p>
        </section>

        {/* Two streams: role | library */}
        <div className="relative grid min-w-0 gap-10 pb-20 lg:grid-cols-2">
          <svg
            className="thread-svg hidden lg:block"
            aria-hidden="true"
            style={{ left: "50%", width: 2, transform: "translateX(-1px)" }}
          >
            <line className="thread-dim" x1="1" y1="0" x2="1" y2="100%" />
          </svg>
          {/* Stacked: the seam becomes one thread in the left gutter keeping the pins connected. */}
          <svg className="thread-svg lg:hidden" aria-hidden="true" style={{ left: -14, width: 2 }}>
            <line className="thread-dim" x1="1" y1="0" x2="1" y2="100%" />
          </svg>
          <section aria-labelledby="role-label" className="min-w-0">
            <p id="role-label" className="label label-paper mb-3.5">
              The role
            </p>
            <div className="card relative flex min-h-[480px] flex-col gap-4 p-8">
              <i className="pin" aria-hidden="true" />
              <HomePasteBox />
            </div>
          </section>

          <section aria-labelledby="lib-label" className="min-w-0">
            <div className="mb-3.5 flex items-baseline justify-between">
              <p id="lib-label" className="label label-paper">
                The library
              </p>
              <p className="label label-paper">
                {capabilityCount} capabilities &middot; {itemCount} items &middot; live
              </p>
            </div>
            <ul className="grid min-w-0 list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
              {LIBRARY_INDEX.map((name) => (
                <li key={name} className={`cap relative ${CHOSEN.has(name) ? "pinned" : "dim"}`}>
                  {CHOSEN.has(name) && <i className="pin" aria-hidden="true" />}
                  {name}
                </li>
              ))}
            </ul>
            <p className="body mt-5" style={{ color: "var(--mint)", fontSize: 14.5, maxWidth: "52ch" }}>
              Every capability is defined, itemised and calibrated before it can be chosen. The
              six pinned here are what this example role turned on.
            </p>
          </section>
        </div>

        {/* Merge: the assessment sheet */}
        <section aria-labelledby="asmt-title" className="pb-24">
          <div className="card relative grid min-w-0 gap-12 p-9 lg:grid-cols-[7fr_4fr]">
            <i className="pin pin-left" aria-hidden="true" />
            <i className="pin pin-right" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-3.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h2 id="asmt-title" className="title" style={{ fontSize: 26, fontFamily: "var(--display)", fontWeight: 400 }}>
                  The assessment for this role
                </h2>
                <span className="measure">6 capabilities &middot; 36 items &middot; about 7 min</span>
              </div>
              <div className="rule" />
              <ol className="m-0 flex list-none flex-col p-0">
                {ASSESSMENT_FACTORS.map((f, i) => (
                  <li
                    key={f.name}
                    className={`grid grid-cols-[160px_1fr] gap-5 py-3 sm:grid-cols-[220px_1fr] ${i < ASSESSMENT_FACTORS.length - 1 ? "border-b" : ""}`}
                    style={{ borderColor: "var(--paper-edge)" }}
                  >
                    <span className="title" style={{ fontSize: 16 }}>
                      {f.name}
                    </span>
                    <span className="body-soft">{f.body}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative flex min-w-0 flex-col gap-3.5">
              <p className="label label-ink">How much of the role to measure</p>
              <div className="card flex items-baseline justify-between gap-3 p-4" style={{ boxShadow: "none", border: "1px solid var(--paper-edge)" }}>
                <span className="title" style={{ fontSize: 16, fontWeight: 400 }}>
                  Essentials
                </span>
                <span className="measure">4 capabilities &middot; ~5 min</span>
              </div>
              <div className="card lift relative flex items-baseline justify-between gap-3 p-4" style={{ border: "1px solid var(--gold)" }}>
                <span className="title" style={{ fontSize: 16 }}>
                  Core
                </span>
                <span className="measure">6 capabilities &middot; ~7 min</span>
                <span className="stamp" style={{ right: -14, top: -18 }}>
                  Recommended for this role
                </span>
              </div>
              <div className="card flex items-baseline justify-between gap-3 p-4" style={{ boxShadow: "none", border: "1px solid var(--paper-edge)" }}>
                <span className="title" style={{ fontSize: 16, fontWeight: 400 }}>
                  Full picture
                </span>
                <span className="measure">8 capabilities &middot; ~10 min</span>
              </div>
              <p className="body-soft mt-1.5" style={{ fontSize: 13.5 }}>
                More capabilities means a broader read of the person and more to interpret. The
                time stays short either way.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="method" aria-labelledby="how-title" className="pb-24">
          <h2 id="how-title" className="headline mb-11" style={{ maxWidth: "20ch" }}>
            Three passes over the role, then the choice is yours.
          </h2>
          <div className="grid min-w-0 gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.label} className="card relative flex flex-col gap-2.5 p-6">
                <i className="pin" aria-hidden="true" />
                <p className="label label-ink">{step.label}</p>
                <p className="title">{step.title}</p>
                <p className="body-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What comes back */}
        <section aria-labelledby="report-title" className="grid min-w-0 gap-16 pb-24 lg:grid-cols-[5fr_6fr] lg:items-start">
          <div>
            <h2 id="report-title" className="headline" style={{ maxWidth: "16ch" }}>
              A report about the person, not a percentile.
            </h2>
            <p className="lede mt-5" style={{ fontSize: 17, maxWidth: "42ch" }}>
              Each capability comes back as a band with what it looks like at that level &mdash;
              strengths, the overuse risk, and what to ask about at interview. It arrives as a PDF
              and as a page.
            </p>
          </div>
          <div className="card relative flex flex-col gap-4 p-8">
            <i className="pin" aria-hidden="true" />
            <div className="flex items-baseline justify-between">
              <p className="title" style={{ fontSize: 17 }}>
                Capability profile
              </p>
              <span className="measure">Report excerpt &middot; synthetic data</span>
            </div>
            <div className="rule" />
            {REPORT_ROWS.map((row) => (
              <div key={row.name} className="report-row">
                <span className="body" style={{ fontSize: 14.5 }}>
                  {row.name}
                </span>
                <div className="band">
                  <i style={{ width: `${row.pct}%` }} />
                  <b style={{ left: `${row.pct}%` }} />
                </div>
                <span className="measure text-right">{row.label}</span>
              </div>
            ))}
            <div className="rule" />
            <p className="body-soft" style={{ fontSize: 13.5 }}>
              Bands are read against the role, with the behaviour each level looks like written
              out beside it.
            </p>
          </div>
        </section>

        {/* Close */}
        <footer className="grid min-w-0 gap-9 pb-16 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 className="headline" style={{ maxWidth: "18ch" }}>
              If this is your kind of problem, we should talk.
            </h2>
            <p className="lede mt-4" style={{ fontSize: 17 }}>
              For partners, larger programmes, or anything the wall can&rsquo;t do on its own.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 lg:col-span-5">
            <a className="on-baize-link" href={`mailto:${CONTACT_EMAIL}`} style={{ fontFamily: "var(--mono)", fontSize: 14 }}>
              {CONTACT_EMAIL}
            </a>
            <div className="flex gap-3">
              <a className="btn btn-primary" href={`mailto:${CONTACT_EMAIL}`}>
                Talk to us
              </a>
              <Link href="/login" className="btn btn-ghost">
                Sign in
              </Link>
            </div>
          </div>
          <p className="label label-paper col-span-full mt-7" style={{ opacity: 0.7 }}>
            &copy; 2026 {PUBLIC_SITE_NAME} &middot; Capabilities, contextualised
          </p>
        </footer>
      </div>
    </div>
  );
}
