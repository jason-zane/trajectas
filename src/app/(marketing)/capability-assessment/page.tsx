import type { Metadata } from "next";
import { SeoPageShell } from "../components/seo-page-shell";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_NAME,
  buildPublicUrl,
  createBreadcrumbJsonLd,
  createWebPageJsonLd,
} from "@/lib/seo/public-site";

const title = "Capability Assessment for Organisations and Roles | Trajectas";
const description =
  "Capability assessment should be built around your organisation, your roles, and your definition of good performance. See how Trajectas approaches capability measurement.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    ...MARKETING_KEYWORDS,
    "capability assessment",
    "organisational capability assessment",
    "role-based capability assessment",
  ],
  alternates: {
    canonical: "/capability-assessment",
  },
  openGraph: {
    title,
    description,
    url: buildPublicUrl("/capability-assessment"),
    siteName: PUBLIC_SITE_NAME,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const jsonLd = [
  createWebPageJsonLd({
    path: "/capability-assessment",
    name: title,
    description,
  }),
  createBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Capability Assessment", path: "/capability-assessment" },
  ]),
];

export default function CapabilityAssessmentPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoPageShell
        eyebrow="Capability assessment"
        title="Capability assessment only works when capability is defined well"
        intro="Capability assessment sounds simple until organisations realise that capability means different things in different settings. Trajectas builds assessments around the actual capabilities your people need to perform, grow, and deliver outcomes in your environment."
        sections={[
          {
            title: "Capability is not generic",
            paragraphs: [
              "Two organisations can use the same job title and still need very different capability profiles. Strategy, operating model, leadership expectations, team structure, and market conditions all influence what good performance looks like.",
              "A capability assessment becomes far more useful when it reflects those differences instead of forcing every organisation into the same benchmark model.",
            ],
          },
          {
            title: "What a capability assessment should measure",
            paragraphs: [
              "Capability assessment should identify the qualities, behaviours, and decision patterns that matter in a role. It should clarify where people are strong, where development is needed, and which capabilities are most tied to performance.",
              "That means measurement has to begin with your definition of capability rather than a borrowed framework that was designed for a different context.",
            ],
          },
          {
            title: "How context changes interpretation",
            paragraphs: [
              "The same assessment result can mean very different things depending on the organisation interpreting it. Context affects whether a capability is mission-critical, developmental, or irrelevant in practice.",
              "Trajectas uses contextual design so capability results can be read against the environment that produced them, making the output more credible and more actionable.",
            ],
          },
          {
            title: "Where capability assessment adds value",
            paragraphs: [
              "Organisations use capability assessment to improve selection, strengthen leadership pipelines, support team design, and build clearer development pathways.",
            ],
            bullets: [
              "Hiring for roles where success depends on specific capability patterns.",
              "Promotion and succession decisions where future trajectory matters.",
              "Leadership development programs that need a sharper definition of good performance.",
              "Organisation-wide capability mapping tied to strategic outcomes.",
            ],
          },
        ]}
        relatedPages={[
          {
            href: "/psychometric-assessment",
            title: "Psychometric assessment",
            description:
              "See how contextual psychometric assessment differs from generic benchmark-led tools.",
          },
          {
            href: "/performance-and-outcomes",
            title: "Performance and outcomes",
            description:
              "Understand how capability assessment becomes more valuable when results can be tied to outcomes.",
          },
          {
            href: "/",
            title: "Trajectas homepage",
            description:
              "Return to the main marketing page and explore the Trajectas approach.",
          },
        ]}
      />
    </>
  );
}
