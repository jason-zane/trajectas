"use client";
import { useState } from "react";
import { submitContact } from "../actions/submit-contact";
const topics = { organisation: "Assessment for my organisation", partner: "Working with Trajectas as a partner", invitation: "A Role Builder invitation", question: "Something else" };
export function ContactForm({ initialTopic }: { initialTopic?: string }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const data = new FormData(event.currentTarget);
    const topic = String(data.get("topic"));
    data.set("message", `${topic}\n\n${data.get("message")}`);
    setPending(true); setError(null);
    try { const result = await submitContact(undefined, data); if (result && "success" in result) setSent(true); else setError(result && "error" in result ? result.error : "We couldn’t send your message. Please try again."); }
    catch { setError("We couldn’t send your message. Your answers are still here. Try again, or email hello@trajectas.com."); }
    finally { setPending(false); }
  }
  if (sent) return <section className="px-contact-success" role="status"><h2>Thank you. We have your message.</h2><p>Your enquiry has been submitted to Trajectas. We’ll respond using the email address you provided.</p><a href="/" className="px-link">Return to the homepage</a></section>;
  return <form className="rb-form" onSubmit={send}><div className="rb-field"><label htmlFor="contact-topic">What would you like to discuss?</label><select name="topic" id="contact-topic" defaultValue={topics[initialTopic as keyof typeof topics] ?? topics.question}>{Object.values(topics).map(topic => <option key={topic}>{topic}</option>)}</select></div><div className="rb-field"><label htmlFor="contact-name">Your name</label><input id="contact-name" name="name" autoComplete="name" required maxLength={200} /></div><div className="rb-field"><label htmlFor="contact-email">Email address</label><input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div><div className="rb-field"><label htmlFor="contact-company">Organisation <span className="px-muted">(optional)</span></label><input id="contact-company" name="company" autoComplete="organization" maxLength={200} /></div><div className="rb-field"><label htmlFor="contact-message">Your message</label><textarea id="contact-message" name="message" required maxLength={4800} rows={6} /></div>{error && <p className="rb-error" role="alert">{error}</p>}<div><button className="px-button" disabled={pending} type="submit">{pending ? "Sending your message…" : "Send message"}</button></div></form>;
}
