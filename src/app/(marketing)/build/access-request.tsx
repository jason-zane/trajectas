"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { requestBuildAccess } from "@/app/actions/public-build-access";
import { BuilderHeading, BuildError } from "./builder-frame";

export function AccessRequest({ email, onEmailChange, onBack }: {
  email: string;
  onEmailChange: (email: string) => void;
  onBack: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ confirmationSent: boolean } | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestBuildAccess({ email: email.trim().toLowerCase() });
        if ("error" in result) setError(result.error);
        else setSent(result);
      } catch { setError("We couldn’t send your request. Check your connection and try again."); }
    });
  }

  return <div className="rb-ready px-enter">
    <BuilderHeading title={sent ? "Your request is with us." : "Request a preview invitation."}>
      {sent ? "The Trajectas team will review your request and email you an invitation code if access is available." : "Leave your email and we’ll let you know about access to the Role Builder. No account needed."}
    </BuilderHeading>
    {sent ? <div role="status" className="rb-form">
      <p>{sent.confirmationSent ? <>We’ve sent a confirmation to <strong>{email.trim()}</strong>. Check your inbox and spam folder.</> : "Your request reached Trajectas, but we couldn’t send your confirmation email. You don’t need to submit again."}</p>
      <p className="rb-help">Requesting an invitation doesn’t grant access automatically.</p>
      <div><button type="button" className="px-button" onClick={onBack}>I have an invitation code</button></div>
    </div> : <form className="rb-form" onSubmit={submit}>
      <div className="rb-field"><label htmlFor="access-email">Email address</label><input id="access-email" name="email" type="email" autoComplete="email" autoFocus required maxLength={254} value={email} onChange={event => onEmailChange(event.target.value)} disabled={pending} placeholder="you@company.com" /></div>
      <p className="rb-help">We’ll use your email to respond to this request and send you a confirmation.</p>
      {error && <BuildError>{error}</BuildError>}
      <div className="px-actions"><button className="px-button" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={17} className="rb-spinner" aria-hidden />Sending request…</> : "Request invitation"}</button><button type="button" className="px-text-button" disabled={pending} onClick={onBack}>I already have a code</button></div>
    </form>}
    <p className="rb-help">Have another question? <Link className="px-link" href="/contact">Contact us</Link></p>
  </div>;
}
