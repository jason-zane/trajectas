"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestNewReportLink } from "@/app/actions/report-resend";

interface Props {
  snapshotId: string | undefined;
}

export function ReportExpiredForm({ snapshotId }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!snapshotId) {
    return (
      <p className="text-sm text-muted-foreground">
        Contact the person who sent you the report to request a new link.
      </p>
    );
  }

  if (submitted) {
    return (
      <p className="text-sm leading-relaxed">
        If your email matches the report, a fresh link is on its way. Please
        check your inbox (and your spam folder) in the next few minutes.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !snapshotId || submitting) return;
    setSubmitting(true);
    try {
      await requestNewReportLink({ snapshotId: snapshotId!, email });
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 items-stretch">
      <Input
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
      />
      <Button type="submit" disabled={!email || submitting}>
        {submitting ? "Sending…" : "Send me a new link"}
      </Button>
    </form>
  );
}
