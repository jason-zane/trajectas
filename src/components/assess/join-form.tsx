"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { registerViaLink } from "@/app/actions/assess";
import type { JoinContent } from "@/lib/experience/types";

interface JoinFormProps {
  linkToken: string;
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: JoinContent;
}

export function JoinForm({
  linkToken,
  brandLogoUrl,
  brandName,
  isCustomBrand,
  content,
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

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header
        className="flex h-14 items-center px-4 sm:px-6"
        style={{
          background: "var(--brand-neutral-50, hsl(var(--background)))",
        }}
      >
        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
            <Image
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              width={140}
              height={28}
              className="h-7 w-auto object-contain"
              unoptimized
            />
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="flex size-7 items-center justify-center rounded-lg"
                style={{
                  background:
                    "var(--brand-surface, hsl(var(--primary) / 0.1))",
                }}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    color: "var(--brand-primary, hsl(var(--primary)))",
                  }}
                >
                  <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <span
                className="text-sm font-semibold tracking-tight"
                style={{
                  color: "var(--brand-text, hsl(var(--foreground)))",
                }}
              >
                {brandName ?? "Trajectas"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full max-w-[540px] space-y-10">
          <div className="space-y-4 text-center">
            <h1
              className="font-sans text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {content.heading}
            </h1>
            <p
              className="text-[1.0625rem] leading-relaxed"
              style={{
                color:
                  "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
              }}
            >
              {content.body}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-l-[3px] p-6 sm:p-8 shadow-sm space-y-4"
            style={{
              borderColor:
                "var(--brand-neutral-200, hsl(var(--border)))",
              borderLeftColor: "var(--brand-primary, hsl(var(--primary)))",
              background:
                "var(--brand-neutral-50, hsl(var(--card)))",
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="join-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="join-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="join-first">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="join-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="join-last">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="join-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="join-job-title">Job title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="join-job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  autoComplete="organization-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="join-company">Company <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="join-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="organization"
                />
              </div>
            </div>

            {content.marketingConsentEnabled && (
              <div className="flex items-start gap-2.5 pt-1">
                <Checkbox
                  id="marketing-consent"
                  checked={marketingConsent}
                  onCheckedChange={(v) => setMarketingConsent(v === true)}
                />
                <label
                  htmlFor="marketing-consent"
                  className="text-sm leading-snug cursor-pointer"
                  style={{
                    color: "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                  }}
                >
                  {content.marketingConsentLabel}
                  {content.marketingConsentRequired && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </label>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-1.5"
              disabled={submitting}
              style={{
                background:
                  "var(--brand-primary, hsl(var(--primary)))",
                color:
                  "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
              }}
            >
              <ArrowRight className="size-4" />
              {submitting ? "Registering..." : content.buttonLabel}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-4 py-4">
        <span
          className="text-xs"
          style={{
            color:
              "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
          }}
        >
          {content.footerText ??
            (isCustomBrand ? "Powered by Trajectas" : "Trajectas")}
        </span>
      </footer>
    </div>
  );
}
