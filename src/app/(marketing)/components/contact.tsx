import { ContactForm } from "./contact-form";

export function Contact() {
  return (
    <section id="contact" data-section="contact" style={{ backgroundColor: "var(--mk-primary-dark)" }}>
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-8 py-24 text-center">
        <p className="mk-eyebrow mb-6">Get in touch</p>
        <h2
          className="mk-display max-w-2xl font-[family-name:var(--font-display)]"
          style={{ color: "var(--mk-text-on-dark)" }}
        >
          Let's talk about what contextual assessment looks like for your organisation.
        </h2>
        <p className="mk-body mt-4 mb-12" style={{ color: "var(--mk-text-on-dark-muted)" }}>
          Tell us what you're working on.
        </p>
        <ContactForm />
      </div>

      <footer
        className="flex items-center justify-between px-8 py-6"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <span className="text-sm font-bold" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
          Trajectas
        </span>
        <span className="text-xs" style={{ color: "rgba(255, 255, 255, 0.2)" }}>
          © 2026 Trajectas
        </span>
      </footer>
    </section>
  );
}
