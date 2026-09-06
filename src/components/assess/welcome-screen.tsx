"use client";

import { BrandLogo } from "@/components/brand/brand-logo";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { WelcomeContent } from "@/lib/experience/types";
import { getTimeOfDayGreeting } from "@/lib/experience/time-greeting";
import type { Campaign, CampaignAssessment } from "@/types/database";
import type { AssessmentForRunner, SessionForRunner } from "@/app/actions/assess";

interface WelcomeScreenProps {
  token: string;
  campaignTitle: string;
  campaignDescription?: string;
  assessmentCount: number;
  participantFirstName?: string;
  estimatedMinutes?: number;
  hasInProgressSession: boolean;
  allowResume: boolean;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: WelcomeContent;
  /** The URL to navigate to when the participant clicks Begin/Resume. Determined server-side from flow config. */
  nextUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
  campaign: Campaign;
  assessments: (CampaignAssessment & AssessmentForRunner)[];
  sessions: SessionForRunner[];
  totalItems: number;
}

export function WelcomeScreen({
  estimatedMinutes,
  hasInProgressSession,
  brandLogoUrl,
  brandName,
  content,
  nextUrl,
  privacyUrl,
  termsUrl,
  campaign,
  assessments,
  sessions,
  totalItems,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ...rest
}: WelcomeScreenProps & Record<string, unknown>) {
  // Greeting is computed at first render: during SSR this uses server time,
  // and on the client the initializer re-runs with the participant's local
  // time — the heading text node carries suppressHydrationWarning so the
  // correction is silent. No effect needed (avoids a cascading re-render).
  const [greetingWord] = useState<string>(
    () => getTimeOfDayGreeting(new Date()).split(" ")[1],
  );

  const totalSections = assessments.reduce((sum, a) => sum + a.sectionCount, 0);

  // Get session status map for assessments
  const sessionStatusMap = new Map(sessions.map((s) => [s.assessmentId, s.status]));

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: "var(--runner-page)" }}
    >
      {/* Header */}
      <header
        className="flex h-14 items-center justify-between border-b px-6 sm:px-10 lg:px-[120px]"
        style={{
          borderColor: "var(--runner-hairline)",
        }}
      >
        <div className="flex items-center">
          <BrandLogo name={brandName} logoUrl={brandLogoUrl} height={28} runner />
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center px-6 py-12 sm:px-10 sm:py-16 lg:px-[120px]">
        <div className="w-full max-w-[620px] space-y-12">
          {/* Eyebrow — defaults to campaign title if not specified */}
          <p
            className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--runner-overline)" }}
          >
            {content.eyebrow || campaign.title}
          </p>

          {/* Heading with time-of-day greeting substitution. The server
              interpolates {{timeOfDayGreeting}} with server time; when (and
              only when) the resolved heading actually starts with that
              greeting pattern, swap the word for the participant's local
              time. Custom headings without a greeting render verbatim. */}
          <h1
            className="font-serif text-[clamp(2.75rem,5vw,2.875rem)] font-semibold leading-[1.15] tracking-[-0.01em]"
            style={{
              color: "var(--runner-display)",
              fontFamily: '"Source Serif 4", Georgia, serif',
            }}
            suppressHydrationWarning
          >
            {greetingWord
              ? content.heading.replace(
                  /^Good (morning|afternoon|evening)\b/,
                  `Good ${greetingWord}`,
                )
              : content.heading}
          </h1>

          {/* Body text */}
          {content.body && (
            <p
              className="text-[0.9375rem] leading-relaxed"
              style={{ color: "var(--runner-text-muted)" }}
            >
              {content.body}
            </p>
          )}

          {/* Invited by section — only shows when inviterName is present */}
          {campaign.inviterName && (
            <div
              className="space-y-3 border-t pt-4"
              style={{ borderColor: "var(--runner-hairline)" }}
            >
              <p
                className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--runner-text-meta)" }}
              >
                Invited by
              </p>
              <div>
                <p
                  className="text-[0.9375rem] font-semibold"
                  style={{ color: "var(--runner-text)" }}
                >
                  {campaign.inviterName}
                </p>
                {campaign.inviterRole && (
                  <p
                    className="text-[0.8125rem]"
                    style={{ color: "var(--runner-text-muted)" }}
                  >
                    {campaign.inviterRole}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Info row: Questions, Sections, Duration with accent dot separators */}
          {(totalItems || totalSections || estimatedMinutes) && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--runner-text-meta)" }}
                >
                  {totalItems
                    ? `${totalItems} ${totalItems === 1 ? "QUESTION" : "QUESTIONS"}`
                    : ""}
                  {totalItems && totalSections && (
                    <span style={{ color: "var(--runner-accent)" }}>
                      {" "}·{" "}
                    </span>
                  )}
                  {totalSections
                    ? `${totalSections} ${totalSections === 1 ? "SECTION" : "SECTIONS"}`
                    : ""}
                  {(totalItems || totalSections) && estimatedMinutes && (
                    <span style={{ color: "var(--runner-accent)" }}>
                      {" "}·{" "}
                    </span>
                  )}
                  {estimatedMinutes ? `~${estimatedMinutes} MIN` : ""}
                  {(totalItems || totalSections || estimatedMinutes) && (
                    <>
                      <span style={{ color: "var(--runner-accent)" }}>
                        {" "}·{" "}
                      </span>
                      <span>PAUSE ANY TIME</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Multi-assessment rows (if more than 1) */}
          {assessments.length > 1 && (
            <div className="space-y-1">
              {assessments.map((assessment) => {
                const status = sessionStatusMap.get(assessment.assessmentId);
                const isDone = status === "completed";

                return (
                  <div
                    key={assessment.assessmentId}
                    className="flex items-center justify-between border-b py-4"
                    style={{ borderColor: "var(--runner-hairline)" }}
                  >
                    <div>
                      <p
                        className="text-[0.9375rem] font-semibold"
                        style={{ color: "var(--runner-text)" }}
                      >
                        {assessment.title}
                      </p>
                      {assessment.description && (
                        <p
                          className="text-[0.8125rem] leading-relaxed"
                          style={{ color: "var(--runner-text-muted)" }}
                        >
                          {assessment.description}
                        </p>
                      )}
                    </div>
                    {isDone ? (
                      <span
                        className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: "var(--runner-text-meta)" }}
                      >
                        DONE
                      </span>
                    ) : (
                      <Link
                        href={nextUrl}
                        prefetch={false}
                        className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] rounded-[10px] border px-4 py-2 transition-all"
                        style={{
                          color: "var(--runner-text)",
                          borderColor: "var(--runner-ghost-border)",
                          backgroundColor: "var(--runner-ghost-fill)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                            "var(--runner-ghost-fill-hover)";
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "var(--runner-ghost-border-hover)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                            "var(--runner-ghost-fill)";
                          (e.currentTarget as HTMLAnchorElement).style.borderColor =
                            "var(--runner-ghost-border)";
                        }}
                      >
                        {status === "in_progress" ? "Resume" : "Begin"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA Button */}
          <div className="flex justify-start pt-4">
            <Link
              href={nextUrl}
              prefetch={false}
              className="rounded-[12px] px-7 py-3 font-sans text-[0.9375rem] font-semibold transition-all"
              style={{
                backgroundColor: "var(--runner-cta-fill)",
                color: "var(--runner-cta-text)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                  "var(--runner-cta-fill-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                  "var(--runner-cta-fill)";
              }}
            >
              {hasInProgressSession ? "Resume Assessment" : "Begin Assessment"}
            </Link>
          </div>

          {/* Confidentiality statement */}
          <div className="flex items-center gap-2.5">
            <Lock
              className="h-4 w-4"
              style={{ color: "var(--runner-text-muted)" }}
            />
            <p
              className="text-[0.8125rem]"
              style={{ color: "var(--runner-text-muted)" }}
            >
              {campaign.confidentialityMode === "aggregate_only"
                ? "Confidential — reported in aggregate only"
                : "Your responses are confidential"}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-4 sm:px-10 lg:px-[120px]">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {privacyUrl && (
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.75rem]"
              style={{
                color: "var(--runner-text-meta)",
                textDecoration: "underline",
                textDecorationColor: "var(--runner-text-meta)",
              }}
            >
              Privacy
            </a>
          )}
          {termsUrl && (
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.75rem]"
              style={{
                color: "var(--runner-text-meta)",
                textDecoration: "underline",
                textDecorationColor: "var(--runner-text-meta)",
              }}
            >
              Terms
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
