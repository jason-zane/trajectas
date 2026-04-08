import type { Metadata } from "next";
import { SeoPageShell } from "../components/seo-page-shell";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_NAME,
  buildPublicUrl,
  createBreadcrumbJsonLd,
  createWebPageJsonLd,
} from "@/lib/seo/public-site";

const title = "Assessment for Performance and Outcomes | Trajectas";
const description =
  "Assessment becomes more useful when it helps organisations connect capability to performance and outcomes. Learn how Trajectas frames that link.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    ...MARKETING_KEYWORDS,
    "performance assessment",
    "assessment outcomes",
    "capability performance outcomes",
  ],
  alternates: {
    canonical: "/performance-and-outcomes",
  },
  openGraph: {
    title,
    description,
    url: buildPublicUrl("/performance-and-outcomes"),
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
    path: "/performance-and-outcomes",
    name: title,
    description,
  }),
  createBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Performance and Outcomes", path: "/performance-and-outcomes" },
  ]),
];

export default function PerformanceAndOutcomesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoPageShell
        eyebrow="Performance and outcomes"
        title="Assessment is stronger when it can predict, prove, or show outcomes"
        intro="Trajectas treats assessment as a way to understand more than a person in isolation. The real value appears when capability can be connected to performance, trajectory, and the outcomes an organisation needs to improve."
        sections={[
          {
            title: "Why outcomes matter in assessment",
            paragraphs: [
              "Many assessments stop at description. They classify people, generate scores, and produce reports, but they never make a clear case for why the result should matter to the organisation.",
              "Assessment becomes more valuable when it can support decisions about who is likely to perform, what capabilities are associated with stronger outcomes, and where development effort should be focused.",
            ],
          },
          {
            title: "Connecting capability to performance",
            paragraphs: [
              "Capability and performance are related, but not identical. Capability assessment should help explain the patterns that sit underneath strong performance rather than pretending that performance can be reduced to one generic benchmark.",
              "That connection becomes clearer when the assessment model is designed around the role, the environment, and the outcomes that define success in practice.",
            ],
          },
          {
            title: "From prediction to evidence",
            paragraphs: [
              "For some organisations, the priority is prediction: which candidates or leaders are most likely to succeed in a role. For others, it is proof: whether an assessment model is genuinely aligned to the performance signals the organisation sees over time.",
              "Trajectas is built to support both perspectives by grounding assessment in the capability definitions and outcome patterns that matter in your setting.",
            ],
          },
          {
            title: "What organisations gain",
            paragraphs: [
              "When capability, performance, and outcomes are linked properly, assessment becomes easier to explain, easier to trust, and easier to use in real decisions.",
            ],
            bullets: [
              "Hiring decisions become more defensible.",
              "Development priorities become clearer.",
              "Leadership and succession discussions become more evidence-led.",
              "Assessment stops being generic data and starts becoming organisational signal.",
            ],
          },
        ]}
        relatedPages={[
          {
            href: "/psychometric-assessment",
            title: "Psychometric assessment",
            description:
              "See how a stronger psychometric assessment model supports better decision quality.",
          },
          {
            href: "/capability-assessment",
            title: "Capability assessment",
            description:
              "Explore how capability should be defined and measured in context.",
          },
          {
            href: "/",
            title: "Trajectas homepage",
            description:
              "Return to the main marketing page and explore the broader Trajectas story.",
          },
        ]}
      />
    </>
  );
}
