import type { Metadata } from "next";
import Link from "next/link";
import { Source_Serif_4 } from "next/font/google";
import { TrajectasLogo } from "@/components/brand/trajectas-logo";
import { PUBLIC_SITE_NAME, buildPublicUrl } from "@/lib/seo/public-site";
import "./welcome.css";

// Display type for the runner-flavoured editorial surface. The rest of the
// stack (Plus Jakarta Sans, Geist Mono) is already provided by the marketing
// layout this route nests inside.
const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

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

const BELIEFS = [
  {
    title: "Capability",
    body: "What counts in one organisation is noise in another. We measure the capabilities your own roles actually turn on.",
  },
  {
    title: "Clarity",
    body: "A person is more than a percentile. The job is to be precise without ever flattening someone into a single score.",
  },
  {
    title: "Growth",
    body: "Understanding only matters if it changes what happens next. We care about the follow-through, so growth is deliberate and it adds up.",
  },
];

const CONTACT_EMAIL = "hello@trajectas.com";

// Applied inline: the CSS build strips backdrop-filter from stylesheets, so the
// transparent-blur nav (like the main marketing nav) sets it here.
const NAV_INLINE_STYLE: React.CSSProperties = {
  backdropFilter: "blur(18px) saturate(160%)",
  WebkitBackdropFilter: "blur(18px) saturate(160%)",
};

/** Hero figure: a trajectory rising over a measured baseline. */
function TrajectoryFigure() {
  return (
    <svg
      className="wl-fig-svg"
      viewBox="0 0 480 380"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="wlFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdae6b" stopOpacity="0.18" />
          <stop offset="1" stopColor="#cdae6b" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="wlGlow">
          <stop offset="0" stopColor="#cdae6b" stopOpacity="0.6" />
          <stop offset="1" stopColor="#cdae6b" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="wl-fig-grid">
        <line x1="30" y1="80" x2="450" y2="80" />
        <line x1="30" y1="160" x2="450" y2="160" />
        <line x1="30" y1="240" x2="450" y2="240" />
        <line x1="30" y1="320" x2="450" y2="320" />
      </g>

      <path
        className="wl-fig-fill"
        d="M40,330 C150,315 160,255 250,260 C345,265 360,150 440,80 L440,360 L40,360 Z"
      />
      <path
        className="wl-fig-curve"
        pathLength={100}
        d="M40,330 C150,315 160,255 250,260 C345,265 360,150 440,80"
      />

      <circle className="wl-fig-node" cx="40" cy="330" r="4" />
      <circle className="wl-fig-node wl-fig-node-2" cx="250" cy="260" r="4" />
      <circle className="wl-fig-glow" cx="440" cy="80" r="26" fill="url(#wlGlow)" />
      <circle className="wl-fig-node-end" cx="440" cy="80" r="6.5" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div data-surface="welcome" className={serif.variable}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Film grain — spans the document and scrolls with the page. */}
      <div className="wl-grain" aria-hidden />

      {/* ===== NAV — fixed, transparent, full-bleed bar ===== */}
      <header className="wl-nav" aria-label="Main navigation" style={NAV_INLINE_STYLE}>
        <div className="wl-nav-inner">
          <Link href="/" aria-label={`${PUBLIC_SITE_NAME} — home`}>
            <TrajectasLogo variant="horizontal" light height={26} />
          </Link>
          <div className="wl-nav-links">
            <Link href="/login" className="wl-signin">
              Sign in
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="wl-nav-cta">
              Get in touch
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ===== HERO ===== */}
        <section className="wl-hero">
          <div className="wl-shell">
            <div className="wl-masthead wl-rise" style={{ animationDelay: "0.05s" }}>
              <p className="wl-eyebrow">Capabilities, contextualised</p>
              <span className="wl-folio">Est. 2026</span>
            </div>

            <div className="wl-hero-grid">
              <div className="wl-hero-copy">
                <h1
                  className="wl-serif wl-hero-title wl-rise"
                  style={{ animationDelay: "0.1s" }}
                >
                  Understanding people is the{" "}
                  <em className="wl-em">real</em> work.
                </h1>
                <p className="wl-lede wl-rise" style={{ animationDelay: "0.2s" }}>
                  Trajectas helps organisations understand the people they
                  depend on, and gives them room to grow. We build psychometric
                  instruments around the capabilities your organisation actually
                  needs, with measurement tied to the outcomes you&rsquo;re
                  trying to move.
                </p>
                <div
                  className="wl-hero-ctas wl-rise"
                  style={{ animationDelay: "0.3s" }}
                >
                  <a href={`mailto:${CONTACT_EMAIL}`} className="wl-btn wl-btn-primary">
                    Talk to us
                  </a>
                  <Link href="/login" className="wl-btn wl-btn-ghost">
                    Sign in
                  </Link>
                </div>
                <p className="wl-hero-meta">People · Capability · Growth</p>
              </div>

              <div className="wl-hero-figure wl-rise" style={{ animationDelay: "0.25s" }}>
                <TrajectoryFigure />
              </div>
            </div>
          </div>
        </section>

        {/* ===== BELIEFS — three-column index ===== */}
        <section className="wl-beliefs" aria-labelledby="wl-beliefs-title">
          <div className="wl-shell">
            <div className="wl-beliefs-head">
              <p className="wl-eyebrow">What we care about</p>
              <p id="wl-beliefs-title" className="wl-serif wl-beliefs-lead">
                A few beliefs behind the work.
              </p>
            </div>
            <ol className="wl-beliefs-grid">
              {BELIEFS.map((belief, i) => (
                <li key={belief.title} className="wl-belief">
                  <span className="wl-belief-num" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="wl-belief-title">{belief.title}</h2>
                  <p className="wl-belief-body">{belief.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ===== CLOSING — statement + contact ===== */}
        <section className="wl-closing">
          <div className="wl-shell wl-closing-grid">
            <div className="wl-closing-main">
              <p className="wl-eyebrow">Say hello</p>
              <p className="wl-serif wl-closing-line">
                If this sounds like your kind of problem, we should talk.
              </p>
            </div>
            <div className="wl-closing-contact">
              <a href={`mailto:${CONTACT_EMAIL}`} className="wl-mail">
                {CONTACT_EMAIL}
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} className="wl-btn wl-btn-primary">
                Get in touch
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="wl-footer">
        <div className="wl-shell wl-footer-inner">
          <span>© 2026 {PUBLIC_SITE_NAME}</span>
          <span>Capabilities, contextualised</span>
        </div>
      </footer>
    </div>
  );
}
