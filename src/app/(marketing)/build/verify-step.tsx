"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Mail, LoaderCircle } from "lucide-react";
import { requestCode, verifyCode } from "@/app/actions/public-builds";
import { BuilderHeading, BuildError } from "./builder-frame";

export function VerifyStep({ inviteRequired, onVerified }: { inviteRequired: boolean; onVerified: (email: string) => void | Promise<void> }) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function sendCode() {
    setError(null); setNotice(null);
    startTransition(async () => {
      try {
        const result = await requestCode({ email: email.trim().toLowerCase(), inviteCode: inviteCode.trim() || undefined });
        if ("error" in result) { setError(result.error); return; }
        setStage("code"); setCode(""); setNotice("A new code is on its way. Check your inbox and spam folder.");
      } catch { setError("We couldn’t send a code. Check your connection and try again."); }
    });
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stage === "email") { sendCode(); return; }
    setError(null); setNotice(null);
    startTransition(async () => {
      try {
        const result = await verifyCode({ email: email.trim().toLowerCase(), code });
        if ("error" in result) { setError(result.error); return; }
        await onVerified(email.trim().toLowerCase());
      } catch { setError("We couldn’t verify that code. Check your connection and try again."); }
    });
  }
  return <div className="px-enter">
    <BuilderHeading title={stage === "email" ? "Try it with a role you know." : "Check your inbox."}>{stage === "email" ? "Build a focused assessment, take it yourself and get your report. First, verify the email you’d like us to send it to." : <>Enter the six-digit code sent to <strong>{email}</strong>. It expires after 10 minutes.</>}</BuilderHeading>
    <div className="rb-layout"><form className="rb-form" onSubmit={submit}>
      {stage === "email" ? <>
        {inviteRequired && <div className="rb-note">The Role Builder is invitation-only during preview. You’ll need an invitation code to continue. <a href="mailto:hello@trajectas.com?subject=Role%20Builder%20preview">Request access</a>.</div>}
        <div className="rb-field"><label htmlFor="rb-email">Email address</label><input id="rb-email" name="email" type="email" autoComplete="email" required maxLength={320} value={email} disabled={pending} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></div>
        {inviteRequired && <div className="rb-field"><label htmlFor="rb-invite">Invitation code</label><input id="rb-invite" required autoComplete="off" value={inviteCode} disabled={pending} onChange={e => setInviteCode(e.target.value)} aria-describedby="invite-help" /><p id="invite-help" className="rb-help">Use the invitation code you received from Trajectas.</p></div>}
      </> : <><div className="rb-field"><label htmlFor="rb-code">Verification code</label><input id="rb-code" className="rb-code" autoFocus autoComplete="one-time-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={pending} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} aria-describedby="code-help" /><p id="code-help" className="rb-help">You can paste the full code.</p></div>{notice && <p role="status" className="rb-help">{notice}</p>}</>}
      {error && <BuildError>{error}</BuildError>}
      <div className="px-actions"><button type="submit" className="px-button" disabled={pending}>{pending ? <><LoaderCircle size={17} className="rb-spinner" aria-hidden />{stage === "email" ? "Sending code…" : "Verifying…"}</> : <>{stage === "email" ? "Send verification code" : "Verify and continue"}<ArrowRight size={17} aria-hidden /></>}</button>{stage === "code" && <button type="button" className="px-text-button" disabled={pending} onClick={() => { setStage("email"); setCode(""); setError(null); }}>Change email</button>}</div>
      {stage === "code" ? <button type="button" className="px-text-button" disabled={pending} onClick={sendCode}>Send a new code</button> : <p className="rb-help">No account or payment required. We verify your email before processing your role.</p>}
    </form><aside className="rb-aside"><h2>A real assessment.<br />A clear sense of the experience.</h2><ul><li><Check size={17} aria-hidden />Capabilities matched to your role</li><li><Check size={17} aria-hidden />Your choice of 4–8 capabilities</li><li><Check size={17} aria-hidden />About 5–10 minutes to complete</li><li><Mail size={17} aria-hidden />Your report by email</li></ul><p>This trial is for you to take yourself. For assessments with your team or clients, <a className="px-link" href="mailto:hello@trajectas.com">talk to us</a>.</p></aside></div>
  </div>;
}
