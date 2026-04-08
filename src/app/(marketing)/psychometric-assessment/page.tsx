import type { Metadata } from "next";
import { SeoPageShell } from "../components/seo-page-shell";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_NAME,
  buildPublicUrl,
  createBreadcrumbJsonLd,
  createWebPageJsonLd,
} from "@/lib/seo/public-site";

const title = "Psychometric Assessment for Capability and Performance | Trajectas";
const description =
  "Learn how contextual psychometric assessment can measure capability, inform performance decisions, and connect assessment results to real organisational outcomes.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    ...MARKETING_KEYWORDS,
    "psychometric assessment for organisations",
    "contextual psychometric assessment",
  ],
  alternates: {
    canonical: "/psychometric-assessment",
  },
  openGraph: {
    title,
    description,
    url: buildPublicUrl("/psychometric-assessment"),
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
    path: "/psychometric-assessment",
    name: title,
    description,
  }),
  createBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Psychometric Assessment", path: "/psychometric-assessment" },
  ]),
];

export default function PsychometricAssessmentPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoPageShell
        eyebrow="Psychometric assessment"
        title="Psychometric assessment should reflect the organisation it serves"
        intro="Trajectas approaches psychometric assessment as a decision system, not a generic benchmark. Instead of relying on one-size-fits-all models, we build assessment around the capabilities your roles require, the context your people work in, and the outcomes you need to understand."
        sections={[
          {
            title: "What psychometric assessment should actually do",
            paragraphs: [
              "A useful psychometric assessment should do more than produce a score. It should help an organisation make better decisions about hiring, development, succession, leadership, and role fit.",
              "That means the assessment needs to be grounded in the capabilities that matter in a real organisational setting, rather than treating every role, team, and business as if they operate under the same conditions.",
            ],
          },
          {
            title: "Why generic assessments create weak signal",
            paragraphs: [
              "Generic psychometric tools often depend on standardised frameworks, off-the-shelf benchmarks, and broad comparison groups. Those models can be useful for mass-market scale, but they often flatten the differences that matter most inside an organisation.",
              "If the assessment model is not built around your context, it becomes harder to connect scores to capability, harder to interpret performance, and harder to defend decisions based on the result.",
            ],
          },
          {
            title: "What contextual psychometric assessment looks like",
            paragraphs: [
              "A contextual approach starts with organisational reality: what the role demands, how capability is defined in your environment, and which performance outcomes matter most.",
            ],
            bullets: [
              "Your organisational context informs what the assessment measures.",
              "Your definition of capability drives the assessment model.",
              "Your performance outcomes shape how results are interpreted.",
              "Your decisions become easier to explain because the logic is specific to your environment.",
            ],
          },
          {
            title: "When organisations need a better assessment model",
            paragraphs: [
              "This matters most when the decision is costly, the role is complex, or the organisation needs evidence that assessment is doing more than generating interesting data.",
              "Psychometric assessment becomes far more useful when it can predict performance, show trajectory, and reveal how capability links to outcomes that leaders actually care about.",
            ],
          },
        ]}
        relatedPages={[
          {
            href: "/capability-assessment",
            title: "Capability assessment",
            description:
              "How to define and measure capability in a way that reflects your roles and your organisation.",
          },
          {
            href: "/performance-and-outcomes",
            title: "Performance and outcomes",
            description:
              "How assessment becomes more valuable when it is tied to performance and measurable outcomes.",
          },
          {
            href: "/",
            title: "Trajectas homepage",
            description:
              "Return to the main marketing page and start a conversation about a contextual assessment model.",
          },
        ]}
      />
    </>
  );
}
