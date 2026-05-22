"use client";

import { useState } from "react";
import { Bell, Mail, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface NotificationsStepValue {
  enabled: boolean;
  emails: string[];
  includeSummary: boolean;
  attachPdf: boolean;
}

interface Props {
  value: NotificationsStepValue;
  onChange: (next: NotificationsStepValue) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationsStep({ value, onChange }: Props) {
  const [draftEmail, setDraftEmail] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  function patch(update: Partial<NotificationsStepValue>) {
    onChange({ ...value, ...update });
  }

  function handleAddEmail() {
    const trimmed = draftEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_RE.test(trimmed)) {
      setDraftError("Enter a valid email address.");
      return;
    }
    if (value.emails.includes(trimmed)) {
      setDraftError("Already in the list.");
      return;
    }
    patch({ emails: [...value.emails, trimmed] });
    setDraftEmail("");
    setDraftError(null);
  }

  function handleRemoveEmail(email: string) {
    patch({ emails: value.emails.filter((e) => e !== email) });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">
          Notify consultants
        </h3>
        <p className="text-sm text-muted-foreground">
          Send an email when a participant completes the assessment — useful
          for coaches, account managers, or anyone tracking outcomes.
        </p>
      </div>

      {/* Master toggle */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">Notify on completion</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sends after the report is fully generated, so the PDF is always
                available.
              </p>
            </div>
          </div>
          <Switch
            checked={value.enabled}
            onCheckedChange={(v) => patch({ enabled: v })}
          />
        </div>
      </div>

      {/* Recipients + sub-toggles, dimmed when master off */}
      <div
        className={
          value.enabled
            ? "space-y-5"
            : "space-y-5 pointer-events-none opacity-40"
        }
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipients</label>
          {value.emails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No recipients yet. Add one below.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {value.emails.map((email) => (
                <li
                  key={email}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="consultant@example.com"
              value={draftEmail}
              onChange={(e) => {
                setDraftEmail(e.target.value);
                if (draftError) setDraftError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddEmail();
                }
              }}
              className={draftError ? "border-destructive" : ""}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEmail}
              disabled={!draftEmail.trim()}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          {draftError ? (
            <p className="text-xs text-destructive">{draftError}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="Include score summary"
            description="Embed the composite score and per-dimension breakdown in the email body."
            checked={value.includeSummary}
            onCheckedChange={(v) => patch({ includeSummary: v })}
          />
          <ToggleRow
            label="Attach PDF"
            description="Attach the rendered report PDF to the email."
            checked={value.attachPdf}
            onCheckedChange={(v) => patch({ attachPdf: v })}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
