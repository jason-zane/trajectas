import { CalendarCard } from "./calendar-card";

export function Contact() {
  return (
    <section
      id="contact"
      className="tj-section tj-contact"
      data-section="contact"
      aria-label="Contact us"
    >
      <div className="tj-contact-grid">
        <div className="tj-contact-pitch">
          <p className="tj-eyebrow">Get in touch</p>
          <h2 className="tj-h2">
            Tell us what capability looks like in your world.
          </h2>
          <p className="tj-lede">
            Thirty minutes, no pitch. Bring an actual problem — a hiring
            decision, a promotion call, a capability gap you can&apos;t name —
            and we&apos;ll show you how a tailored instrument would approach
            it.
          </p>

          <ol className="tj-contact-paths">
            <li>
              <span className="tj-contact-path-step">1</span>
              <div>
                <h3>Pick a time</h3>
                <p>
                  Grab any 30-minute slot from the calendar. Confirmed
                  instantly.
                </p>
                <span className="tj-contact-path-meta">
                  30-min video call · APAC hours
                </span>
              </div>
            </li>
            <li>
              <span className="tj-contact-path-step">2</span>
              <div>
                <h3>Prefer email?</h3>
                <p>
                  Send a line about what you&apos;re trying to measure — happy
                  to start there instead.
                </p>
                <a
                  href="mailto:hello@trajectas.com?subject=Discovery%20call"
                  className="tj-btn tj-btn-ghost tj-contact-email"
                >
                  hello@trajectas.com →
                </a>
              </div>
            </li>
          </ol>
        </div>
        <CalendarCard />
      </div>
    </section>
  );
}
