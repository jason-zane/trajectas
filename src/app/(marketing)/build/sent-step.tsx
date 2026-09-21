"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { estimatePublicBuildMinutes, PUBLIC_BUILDS_ITEMS_PER_FACTOR } from "@/lib/public-builds/shared";

export function SentStep({ email, roleTitle, capabilityCount, token, emailSent, resumed = false }: { email: string; roleTitle: string; capabilityCount: number; token: string; emailSent: boolean | null; resumed?: boolean }) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const path = `/assess/${encodeURIComponent(token)}`;
  async function copy() {
    try { await navigator.clipboard.writeText(new URL(path, window.location.origin).href); setCopyStatus("Link copied. Keep it private — it gives access to your assessment."); }
    catch { setCopyStatus("Couldn’t copy the link. Open the assessment and copy the address from your browser."); }
  }
  return <section className="rb-ready px-enter"><div className="rb-success-mark"><Check size={26} aria-hidden /></div><h1 tabIndex={-1} data-step-heading>{resumed ? "Your assessment is here." : "Your assessment is ready."}</h1><p>{roleTitle}</p><div className="rb-ready-summary"><span>{capabilityCount} capabilities</span><span>{capabilityCount * PUBLIC_BUILDS_ITEMS_PER_FACTOR} questions</span><span>About {estimatePublicBuildMinutes(capabilityCount)} minutes</span></div>
    <p>Take the assessment yourself to experience the questions and see your report.</p><div className="px-actions"><a href={path} className="px-button">{resumed ? "Continue to assessment" : "Take my assessment"}<ArrowRight size={18} aria-hidden /></a><button className="px-text-button" type="button" onClick={copy}><Copy size={16} aria-hidden />Copy private link</button></div>{copyStatus && <p role="status" className="rb-help">{copyStatus}</p>}
    {emailSent === true ? <p className="rb-note">We also sent the link to <strong>{email}</strong>, so you can return later. It is valid for 7 days from creation.</p> : emailSent === false ? <p className="rb-note" role="status">Your assessment is ready, but we couldn’t deliver the email to <strong>{email}</strong>. Use the button above and save your private link.</p> : <p className="rb-note">We recovered your existing assessment. Use the button above to continue. The link is valid for 7 days from creation.</p>}
    <div className="rb-next"><h2>After you finish</h2><p>Your report will be available in the assessment experience and sent to {email}. Complete this assessment before building another role.</p><h2>Thinking about your team?</h2><p>Talk to us about using Trajectas across your organisation or with your clients.</p><a className="px-link" href="mailto:hello@trajectas.com">Talk to Trajectas <ArrowRight size={16} aria-hidden /></a></div>
  </section>;
}
