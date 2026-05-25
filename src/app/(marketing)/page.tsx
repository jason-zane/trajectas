import type { Metadata } from "next";
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { Problem } from "./components/problem";
import { Journey } from "./components/journey";
import { Science } from "./components/science";
import { TryIt } from "./components/try-it";
import { UseCases } from "./components/use-cases";
import { Compare } from "./components/compare";
import { Contact } from "./components/contact";
import { Footer } from "./components/footer";
import { MarketingInteractive } from "./components/marketing-islands";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_TAGLINE,
  buildPublicUrl,
} from "@/lib/seo/public-site";

const title = `${PUBLIC_SITE_NAME} — ${PUBLIC_SITE_TAGLINE}`;
const description = PUBLIC_SITE_DESCRIPTION;

export const metadata: Metadata = {
  title,
  description,
  keywords: [...MARKETING_KEYWORDS],
  alternates: {
    canonical: "/",
  },
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

const homeStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PUBLIC_SITE_NAME,
    alternateName: "Trajectas Assessment",
    url: buildPublicUrl("/"),
    logo: buildPublicUrl("/brand/span-lockup-horizontal.svg"),
    description,
    foundingDate: "2025",
    knowsAbout: [
      "Psychometric assessment",
      "Capability assessment",
      "Organisational psychology",
      "Performance prediction",
      "Behavioural measurement",
      "Workforce capability mapping",
    ],
    sameAs: [
      "https://www.linkedin.com/company/trajectas",
    ],
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
    alternateName: PUBLIC_SITE_TAGLINE,
    url: buildPublicUrl("/"),
    description,
    inLanguage: "en-AU",
    publisher: {
      "@type": "Organization",
      name: PUBLIC_SITE_NAME,
      url: buildPublicUrl("/"),
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Contextual psychometric assessment",
    name: "Trajectas capability assessment",
    provider: {
      "@type": "Organization",
      name: PUBLIC_SITE_NAME,
      url: buildPublicUrl("/"),
    },
    areaServed: ["AU", "APAC", "EU", "UK", "North America"],
    description:
      "Bespoke psychometric instruments built around your organisation's capabilities, calibrated to the roles and outcomes you actually care about.",
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        "Heads of People, Talent Leaders, Consulting Partners, Org Design Teams",
    },
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "AUD",
        description: "Engagement-based pricing — discussed during discovery.",
      },
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How is Trajectas different from SHL, Korn Ferry or Predictive Index?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Legacy providers score people against a single fixed model of human potential. Trajectas builds the assessment around your organisation's capability model and the performance outcomes you're trying to move, so the result is calibrated to your roles rather than a generic benchmark.",
        },
      },
      {
        "@type": "Question",
        name: "What does \"capabilities, contextualised\" actually mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The capabilities that predict a strong hire in one organisation are often noise in another. We measure the capabilities your roles actually depend on, then link the measurement to the performance signals you choose to share.",
        },
      },
      {
        "@type": "Question",
        name: "Is the assessment psychometrically rigorous?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Items are calibrated for reliability and discrimination before they reach a participant. The underlying statistics — classical test theory and exploratory / confirmatory factor analysis — are inspectable in the builder rather than hidden behind marketing copy.",
        },
      },
      {
        "@type": "Question",
        name: "How long does it take to get to a first instrument?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A typical scoping-to-first-instrument cycle is around three weeks. Discovery maps your roles and outcomes, the model is built and reviewed by your team, and participants take the assessment in a co-branded runner.",
        },
      },
      {
        "@type": "Question",
        name: "Can I book a discovery call?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — pick a 30-minute slot from the calendar on the contact section of the home page, or email hello@trajectas.com.",
        },
      },
    ],
  },
];

export default function MarketingPage() {
  return (
    <div className="tj">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeStructuredData),
        }}
      />
      <MarketingInteractive />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Journey />
        <Science />
        <TryIt />
        <UseCases />
        <Compare />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
