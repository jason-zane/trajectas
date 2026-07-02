"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { saveDemographics } from "@/app/actions/experience";
import type {
  DemographicsContent,
  DemographicsFieldConfig,
} from "@/lib/experience/types";

interface DemographicsFormProps {
  token: string;
  participantId: string;
  fields: DemographicsFieldConfig[];
  brandLogoUrl?: string;
  brandName?: string;
  isCustomBrand?: boolean;
  content: DemographicsContent;
  nextUrl: string;
  privacyUrl?: string;
  termsUrl?: string;
}

export function DemographicsForm({
  token,
  participantId,
  fields,
  isCustomBrand,
  content,
  nextUrl,
  privacyUrl,
  termsUrl,
   
}: DemographicsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const enabledFields = fields.filter((f) => f.enabled);

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const field of enabledFields) {
      if (field.required && !values[field.key]?.trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    await saveDemographics(token, participantId, values);
    router.push(nextUrl);
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--runner-page)" }}>
      {/* Header — omitted per design, runner layout handles it */}

      {/* Main content — full-bleed dark editorial */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-[120px]">
        <div className="w-full max-w-[620px] space-y-12">
          {/* Heading section — serif display + body copy */}
          <div className="space-y-4">
            {content.eyebrow && (
              <p
                className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em]"
                style={{
                  color: "var(--runner-overline)",
                }}
              >
                {content.eyebrow}
              </p>
            )}
            <h1
              className="font-serif text-[clamp(1.875rem, 5vw, 2.25rem)] font-600 leading-[1.1] tracking-[-0.01em]"
              style={{
                color: "var(--runner-display)",
                fontFamily: '"Source Serif 4", Georgia, serif',
                letterSpacing: "-0.01em",
              }}
            >
              {content.heading}
            </h1>
            {content.body && (
              <p
                className="text-sm sm:text-base leading-relaxed"
                style={{
                  color: "var(--runner-text-muted)",
                }}
              >
                {content.body}
              </p>
            )}
          </div>

          {/* Form fields — 2-column grid on desktop */}
          <form
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {enabledFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  {/* Label — 12px/600 with optional suffix */}
                  <label
                    htmlFor={`demo-${field.key}`}
                    className="block text-[0.75rem] font-semibold uppercase tracking-[0.08em]"
                    style={{
                      color: "var(--runner-text)",
                    }}
                  >
                    {field.label}
                    {!field.required && (
                      <span
                        className="font-normal"
                        style={{
                          color: "var(--runner-text-faint)",
                        }}
                      >
                        {" · optional"}
                      </span>
                    )}
                  </label>

                  {/* Field input or select */}
                  {field.type === "select" && field.options ? (
                    <div className="relative">
                      <select
                        id={`demo-${field.key}`}
                        value={values[field.key] ?? ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full appearance-none rounded-[10px] px-3 py-2.5 text-sm pr-9 font-medium transition-colors"
                        style={{
                          background: "var(--runner-input-fill)",
                          border: "1px solid var(--runner-input-border)",
                          color: values[field.key] ? "var(--runner-text)" : "var(--runner-placeholder)",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "var(--runner-input-border-focus)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "var(--runner-input-border)";
                        }}
                      >
                        <option value="" disabled>
                          Select…
                        </option>
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none size-4"
                        style={{
                          color: "var(--runner-text-faint)",
                        }}
                      />
                    </div>
                  ) : (
                    <input
                      id={`demo-${field.key}`}
                      type="text"
                      value={values[field.key] ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.label}
                      className="w-full rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors"
                      style={{
                        background: "var(--runner-input-fill)",
                        border: "1px solid var(--runner-input-border)",
                        color: "var(--runner-text)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--runner-input-border-focus)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--runner-input-border)";
                      }}
                    />
                  )}

                  {/* Validation error */}
                  {errors[field.key] && (
                    <p
                      className="text-xs font-medium"
                      style={{
                        color: "var(--brand-error)",
                      }}
                    >
                      {errors[field.key]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* CTA button */}
            <div className="flex justify-center pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-[10px] px-7 py-3 text-[0.9375rem] font-semibold transition-colors disabled:opacity-50"
                style={{
                  background: "var(--runner-cta-fill)",
                  color: "var(--runner-cta-text)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--runner-cta-fill-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--runner-cta-fill)";
                }}
              >
                {submitting ? "Continuing…" : content.buttonLabel ?? "Continue"}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer — minimal per design */}
      <footer className="flex items-center justify-center gap-2 px-6 py-3 text-xs">
        <span
          style={{
            color: "var(--runner-text-meta)",
          }}
        >
          {content.footerText ??
            (isCustomBrand ? "Powered by Trajectas" : "Your responses are confidential")}
        </span>
        {privacyUrl && (
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline underline-offset-2"
            style={{ color: "var(--runner-text-meta)" }}
          >
            Privacy
          </a>
        )}
        {termsUrl && (
          <a
            href={termsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline underline-offset-2"
            style={{ color: "var(--runner-text-meta)" }}
          >
            Terms
          </a>
        )}
      </footer>
    </div>
  );
}
