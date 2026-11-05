"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ParticipantPrivacyNotice } from "@/lib/privacy/notice";

interface PrivacyAcknowledgementProps {
  notice: ParticipantPrivacyNotice;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  researchConsent: boolean;
  onResearchChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** The notice stays available without making the full text a compulsory step. */
export function PrivacyAcknowledgement({
  notice, checked, onCheckedChange, researchConsent, onResearchChange, disabled,
}: PrivacyAcknowledgementProps) {
  const acknowledgementId = useId();
  const researchId = useId();

  return (
    <div className="space-y-4" style={{ color: "var(--runner-text)" }}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={acknowledgementId}
          checked={checked}
          required
          onCheckedChange={value => onCheckedChange(value === true)}
          disabled={disabled}
          className="mt-1 size-5"
          style={{
            background: checked ? "var(--runner-accent)" : "transparent",
            borderColor: checked ? "var(--runner-accent)" : "var(--runner-input-border)",
            color: checked ? "var(--runner-cta-text)" : undefined,
          }}
        />
        <label htmlFor={acknowledgementId} className="cursor-pointer text-sm leading-relaxed">
          {notice.acknowledgementLabel}
        </label>
      </div>

      <Dialog>
        <DialogTrigger
          type="button"
          className="w-fit cursor-pointer text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ color: "var(--runner-text)" }}
        >
          Read assessment privacy information
        </DialogTrigger>
        <DialogContent
          className="flex max-h-[85dvh] flex-col gap-5 p-6 sm:max-w-[640px]"
          aria-describedby={undefined}
          style={{
            background: "var(--runner-page-solid)",
            color: "var(--runner-text)",
            fontFamily: '"Plus Jakarta Sans", var(--brand-font-body, system-ui, sans-serif)',
          }}
        >
          <DialogHeader className="shrink-0 pr-7">
            <DialogTitle className="text-xl leading-snug">{notice.title}</DialogTitle>
          </DialogHeader>
          <div
            role="region"
            aria-label="Assessment privacy information"
            tabIndex={0}
            className="min-h-0 space-y-4 overflow-y-auto pr-2 text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {notice.body.split(/\n\s*\n/).filter(paragraph => paragraph.trim()).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">{paragraph}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {notice.researchChoiceEnabled && (
        <div className="flex items-start gap-3">
          <Checkbox id={researchId} checked={researchConsent} onCheckedChange={value => onResearchChange(value === true)} disabled={disabled} className="mt-1" />
          <label htmlFor={researchId} className="cursor-pointer text-sm leading-relaxed">{notice.researchLabel}</label>
        </div>
      )}
    </div>
  );
}
