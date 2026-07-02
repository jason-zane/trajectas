"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { registerViaLink } from "@/app/actions/assess";
import type { JoinContent } from "@/lib/experience/types";
import type { Campaign } from "@/types/database";

interface JoinFormProps {
  linkToken: string;
  brandLogoUrl?: string;
  brandName?: string;
  content: JoinContent;
  campaign?: Campaign;
  privacyUrl?: string;
}

export function JoinForm({
  linkToken,
  brandLogoUrl,
  brandName,
  content,
  campaign,
  privacyUrl: privacyUrlProp,
}: JoinFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedJobTitle = jobTitle.trim();
    const trimmedCompany = company.trim();

    if (!trimmedEmail || !trimmedFirstName || !trimmedLastName) {
      setError("Please enter your email, first name, and last name.");
      return;
    }

    if (content.marketingConsentEnabled && content.marketingConsentRequired && !marketingConsent) {
      setError("Please accept the marketing consent to continue.");
      return;
    }

    setSubmitting(true);

    const result = await registerViaLink(linkToken, {
      email: trimmedEmail,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      jobTitle: trimmedJobTitle || undefined,
      company: trimmedCompany || undefined,
      marketingConsent: content.marketingConsentEnabled ? marketingConsent : undefined,
    });

    setSubmitting(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (result.accessToken) {
      router.push(`/assess/${result.accessToken}`);
    }
  }

  // Duration is not available on join page (assessments not fetched) — omit gracefully
  const privacyUrl = privacyUrlProp || undefined;
  const isAggregateOnly = campaign?.confidentialityMode === 'aggregate_only';

  return (
    <div
      className="flex min-h-dvh flex-col lg:flex-row"
      style={{
        background: "var(--runner-page-solid, var(--runner-page))",
      }}
    >
      {/* LEFT PANEL: INVITE (hidden on mobile, visible as header on mobile) */}
      <div
        className="hidden lg:flex lg:w-[390px] flex-col justify-between px-6 sm:px-10 py-10 sm:py-16"
        style={{
          background: "var(--runner-panel-invite)",
          borderRight: "1px solid var(--runner-hairline)",
        }}
      >
        {/* Logo and brand name */}
        <div className="space-y-8">
          <div className="flex flex-col gap-6">
            {/* Logo */}
            {brandLogoUrl ? (
              <div className="h-8 w-auto">
                <Image
                  src={brandLogoUrl}
                  alt={brandName ?? "Logo"}
                  width={140}
                  height={32}
                  className="h-full w-auto object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <svg
                className="h-8 w-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: "var(--runner-accent)",
                }}
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            )}

            {/* Client/Brand name as mono overline */}
            {brandName && (
              <div
                className="text-xs uppercase tracking-[0.12em] font-medium"
                style={{
                  color: "var(--runner-overline)",
                }}
              >
                {brandName}
              </div>
            )}
          </div>

          {/* Main message */}
          <div className="space-y-4">
            <h1
              className="text-3xl sm:text-4xl font-semibold"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                color: "var(--runner-text)",
                letterSpacing: "-0.01em",
                lineHeight: "1.2",
              }}
            >
              You&apos;ve been invited.
            </h1>
            <p
              className="text-sm sm:text-base leading-relaxed"
              style={{
                color: "var(--runner-text-muted)",
              }}
            >
              No preparation needed.
            </p>
          </div>
        </div>

        {/* Inviter block (only if inviterName is set) */}
        {campaign?.inviterName && (
          <div
            className="space-y-4 pt-6"
            style={{
              borderTop: "1px solid var(--runner-hairline)",
            }}
          >
            <div
              className="text-xs uppercase tracking-[0.12em] font-medium"
              style={{
                color: "var(--runner-text-meta)",
              }}
            >
              Invited by
            </div>
            <div>
              <div
                className="text-sm"
                style={{
                  color: "var(--runner-text)",
                }}
              >
                {campaign.inviterName}
              </div>
              {campaign.inviterRole && (
                <div
                  className="text-xs mt-1"
                  style={{
                    color: "var(--runner-text-muted)",
                  }}
                >
                  {campaign.inviterRole}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confidentiality footer */}
        <div
          className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] font-medium"
          style={{
            color: "var(--runner-text-meta)",
          }}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>
            {isAggregateOnly
              ? "Confidential · reported in aggregate"
              : "Confidential"}
          </span>
        </div>
      </div>

      {/* MOBILE HEADER (ink band, visible on mobile only) */}
      <div
        className="lg:hidden flex flex-col gap-4 px-6 py-6 sm:px-8 sm:py-8"
        style={{
          background: "var(--runner-panel-invite)",
          borderBottom: "1px solid var(--runner-hairline)",
        }}
      >
        {/* Logo and brand */}
        <div className="flex items-center gap-3">
          {brandLogoUrl ? (
            <div className="h-7 w-auto">
              <Image
                src={brandLogoUrl}
                alt={brandName ?? "Logo"}
                width={140}
                height={28}
                className="h-full w-auto object-contain"
                unoptimized
              />
            </div>
          ) : (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: "var(--runner-accent)",
              }}
            >
              <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          )}
          {brandName && (
            <div
              className="text-xs uppercase tracking-[0.12em] font-medium"
              style={{
                color: "var(--runner-overline)",
              }}
            >
              {brandName}
            </div>
          )}
        </div>
        {/* Invite message on mobile */}
        <h1
          className="text-2xl font-semibold"
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            color: "var(--runner-text)",
            letterSpacing: "-0.01em",
            lineHeight: "1.2",
          }}
        >
          You&apos;ve been invited.
        </h1>
      </div>

      {/* RIGHT PANEL: FORM */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 sm:px-10 lg:px-[120px] py-10 sm:py-16"
        style={{
          background: "var(--runner-panel-form)",
        }}
      >
        <div className="w-full max-w-[620px] space-y-8">
          {/* Form header */}
          <div className="space-y-4">
            <div
              className="text-xs uppercase tracking-[0.12em] font-medium"
              style={{
                color: "var(--runner-overline)",
              }}
            >
              Register
            </div>
            <h2
              className="text-3xl sm:text-4xl font-semibold"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                color: "var(--runner-text)",
                letterSpacing: "-0.01em",
                lineHeight: "1.2",
              }}
            >
              Register to begin.
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="join-email"
                className="text-xs font-semibold uppercase tracking-[0.06em]"
                style={{
                  color: "var(--runner-text-meta)",
                }}
              >
                Work email
              </label>
              <input
                id="join-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                className="w-full px-4 py-3 rounded-[10px] text-sm transition-colors"
                style={{
                  background: "var(--runner-input-fill)",
                  border: "1px solid var(--runner-input-border)",
                  color: "var(--runner-text)",
                }}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor =
                    "var(--runner-input-border-focus)";
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor =
                    "var(--runner-input-border)";
                }}
              />
            </div>

            {/* First and Last Name grid */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="join-first"
                  className="text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{
                    color: "var(--runner-text-meta)",
                  }}
                >
                  First name
                </label>
                <input
                  id="join-first"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  autoComplete="given-name"
                  required
                  className="w-full px-4 py-3 rounded-[10px] text-sm transition-colors"
                  style={{
                    background: "var(--runner-input-fill)",
                    border: "1px solid var(--runner-input-border)",
                    color: "var(--runner-text)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border-focus)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border)";
                  }}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="join-last"
                  className="text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{
                    color: "var(--runner-text-meta)",
                  }}
                >
                  Last name
                </label>
                <input
                  id="join-last"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  autoComplete="family-name"
                  required
                  className="w-full px-4 py-3 rounded-[10px] text-sm transition-colors"
                  style={{
                    background: "var(--runner-input-fill)",
                    border: "1px solid var(--runner-input-border)",
                    color: "var(--runner-text)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border-focus)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border)";
                  }}
                />
              </div>
            </div>

            {/* Job title and Company grid */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="join-job-title"
                  className="text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{
                    color: "var(--runner-text-meta)",
                  }}
                >
                  <span>Job title</span>
                  <span
                    className="ml-1"
                    style={{
                      color: "var(--runner-text-muted)",
                    }}
                  >
                    · optional
                  </span>
                </label>
                <input
                  id="join-job-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Manager"
                  autoComplete="organization-title"
                  className="w-full px-4 py-3 rounded-[10px] text-sm transition-colors"
                  style={{
                    background: "var(--runner-input-fill)",
                    border: "1px solid var(--runner-input-border)",
                    color: "var(--runner-text)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border-focus)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border)";
                  }}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="join-company"
                  className="text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{
                    color: "var(--runner-text-meta)",
                  }}
                >
                  <span>Company</span>
                  <span
                    className="ml-1"
                    style={{
                      color: "var(--runner-text-muted)",
                    }}
                  >
                    · optional
                  </span>
                </label>
                <input
                  id="join-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc"
                  autoComplete="organization"
                  className="w-full px-4 py-3 rounded-[10px] text-sm transition-colors"
                  style={{
                    background: "var(--runner-input-fill)",
                    border: "1px solid var(--runner-input-border)",
                    color: "var(--runner-text)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border-focus)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--runner-input-border)";
                  }}
                />
              </div>
            </div>

            {/* Marketing consent */}
            {content.marketingConsentEnabled && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="marketing-consent"
                  checked={marketingConsent}
                  onCheckedChange={(v) => setMarketingConsent(v === true)}
                  className="mt-1"
                />
                <label
                  htmlFor="marketing-consent"
                  className="text-xs sm:text-sm leading-relaxed cursor-pointer"
                  style={{
                    color: "var(--runner-text-muted)",
                  }}
                >
                  {content.marketingConsentLabel}
                  {content.marketingConsentRequired && (
                    <span
                      className="ml-1"
                      style={{
                        color: "var(--brand-error)",
                      }}
                    >
                      *
                    </span>
                  )}
                </label>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div
                className="rounded-lg p-3 text-xs sm:text-sm"
                style={{
                  background: "var(--brand-error, #dc2626)",
                  color: "var(--runner-paper)",
                  border: `1px solid var(--brand-error, #dc2626)`,
                }}
              >
                {error}
              </div>
            )}

            {/* CTA Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-7 py-3 rounded-[10px] font-semibold text-sm sm:text-[15px] tracking-wide transition-all duration-200"
              style={{
                background: "var(--runner-cta-fill)",
                color: "var(--runner-cta-text)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--runner-cta-fill-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--runner-cta-fill)";
              }}
            >
              {submitting ? "Registering..." : content.buttonLabel}
            </button>

            {/* Privacy notice */}
            <p
              className="text-xs text-center leading-relaxed"
              style={{
                color: "var(--runner-text-faint)",
              }}
            >
              By continuing you agree to our{" "}
              {privacyUrl ? (
                <a
                  href={privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                  style={{
                    color: "var(--runner-text-faint)",
                  }}
                >
                  privacy notice
                </a>
              ) : (
                "privacy notice"
              )}
              {isAggregateOnly && (
                <>
                  . Your answers are reported in aggregate only.
                </>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
