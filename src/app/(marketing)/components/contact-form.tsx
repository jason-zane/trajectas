"use client";

import { useActionState } from "react";
import { submitContact, type ContactFormState } from "../actions/submit-contact";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    submitContact,
    undefined
  );

  if (state && "success" in state && state.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-12 w-12 items-center justify-center text-2xl" style={{ color: "var(--mk-accent)" }}>
          ✓
        </div>
        <p className="text-lg font-bold" style={{ color: "var(--mk-text-on-dark)" }}>
          We&apos;ll be in touch.
        </p>
      </div>
    );
  }

  const fieldErrors = state && "fields" in state ? state.fields : undefined;

  return (
    <form action={formAction} className="w-full max-w-lg">
      {state && "error" in state && !fieldErrors && (
        <div className="mb-6 rounded-2xl border p-3 text-sm" style={{ borderColor: "rgba(239, 68, 68, 0.5)", color: "#ef4444" }}>
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mk-eyebrow mb-2 block text-[9px]">Name</label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "var(--mk-text-on-dark)" }}
          />
          {fieldErrors?.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name[0]}</p>}
        </div>

        <div>
          <label htmlFor="contact-email" className="mk-eyebrow mb-2 block text-[9px]">Email</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "var(--mk-text-on-dark)" }}
          />
          {fieldErrors?.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email[0]}</p>}
        </div>

        <div className="col-span-1 md:col-span-2">
          <label htmlFor="contact-company" className="mk-eyebrow mb-2 block text-[9px]">Company</label>
          <input
            id="contact-company"
            name="company"
            autoComplete="organization"
            className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "var(--mk-text-on-dark)" }}
          />
        </div>

        <div className="col-span-1 md:col-span-2">
          <label htmlFor="contact-message" className="mk-eyebrow mb-2 block text-[9px]">Message</label>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={4}
            className="w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--mk-accent)]"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "var(--mk-text-on-dark)" }}
          />
          {fieldErrors?.message && <p className="mt-1 text-xs text-red-400">{fieldErrors.message[0]}</p>}
        </div>

        <div className="col-span-1 md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full py-4 text-sm font-bold tracking-wide transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--mk-accent)", color: "var(--mk-primary-dark)" }}
          >
            {pending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </form>
  );
}
