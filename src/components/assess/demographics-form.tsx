"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  brandLogoUrl,
  brandName,
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
            // eslint-disable-next-line @next/next/no-img-element -- brand logo URLs are runtime-configured and can point to arbitrary remote assets
            <img
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              className="h-7 w-auto object-contain"
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
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] space-y-6">
          {/* Title */}
          <div className="space-y-3 text-center">
            {content.eyebrow && (
              <p
                className="text-xs font-medium uppercase tracking-widest"
                style={{
                  color: "var(--brand-primary, hsl(var(--primary)))",
                }}
              >
                {content.eyebrow}
              </p>
            )}
            <h1
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {content.heading}
            </h1>
            <p
              className="text-sm leading-relaxed"
              style={{
                color:
                  "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
              }}
            >
              {content.body}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border p-6 shadow-sm dark:shadow-none space-y-4"
            style={{
              borderColor: "var(--brand-neutral-200, hsl(var(--border)))",
              background: "var(--brand-neutral-50, hsl(var(--card)))",
            }}
          >
            {enabledFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`demo-${field.key}`}>
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </Label>

                {field.type === "select" && field.options ? (
                  <Select
                    value={values[field.key] ?? ""}
                    onValueChange={(v) => handleChange(field.key, v ?? "")}
                  >
                    <SelectTrigger id={`demo-${field.key}`}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`demo-${field.key}`}
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.label}
                  />
                )}

                {errors[field.key] && (
                  <p className="text-xs text-destructive">{errors[field.key]}</p>
                )}
              </div>
            ))}

            <Button
              type="submit"
              className="w-full gap-1.5 mt-2"
              disabled={submitting}
              style={{
                background: "var(--brand-primary, hsl(var(--primary)))",
                color:
                  "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
              }}
            >
              <ArrowRight className="size-4" />
              {submitting ? "Continuing..." : content.buttonLabel}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-3 px-4 py-4">
        <span
          className="text-xs"
          style={{
            color:
              "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
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
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
          >
            Privacy
          </a>
        )}
        {termsUrl && (
          <a
            href={termsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
          >
            Terms
          </a>
        )}
      </footer>
    </div>
  );
}
