import { ContactForm } from "./contact-form";

export function Contact() {
  return (
    <section id="contact" data-section="contact" aria-label="Contact us" style={{ backgroundColor: "var(--mk-primary-dark)" }}>
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16 text-center md:px-8 md:py-24">
        <p className="mk-eyebrow mb-6">Get in touch</p>
        <h2
          className="mk-display max-w-2xl font-[family-name:var(--font-display)]"
          style={{ color: "var(--mk-text-on-dark)" }}
        >
          Tell us what you&apos;re building.
        </h2>
        <p className="mk-body mt-4 mb-12" style={{ color: "var(--mk-text-on-dark-muted)" }}>
          We&apos;ll show you what contextual assessment could look like for your organisation.
        </p>
        <ContactForm />
      </div>

      <footer
        className="flex items-center justify-between px-4 py-6 md:px-8"
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
