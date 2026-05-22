export function Hero() {
  return (
    <section className="tj-hero" data-section="hero">
      <div className="tj-hero-body centered">
        <div className="tj-hero-text-center">
          <p className="tj-eyebrow rise-in" style={{ animationDelay: ".05s" }}>
            Trajectas · Capability assessment
          </p>
          <h1 className="tj-h1 rise-in" style={{ animationDelay: ".1s" }}>
            Capabilities, contextualised.
          </h1>
          <p className="tj-lede rise-in" style={{ animationDelay: ".2s" }}>
            Trajectas builds psychometric instruments around the capabilities
            your organisation actually needs, with measurement tied to the
            outcomes you&apos;re trying to move.
          </p>
          <div
            className="tj-hero-ctas rise-in"
            style={{ animationDelay: ".3s" }}
          >
            <a href="#contact" className="tj-btn tj-btn-primary">
              Book a 30-min discovery call →
            </a>
            <a href="#try" className="tj-btn tj-btn-ghost">
              Take the 60-second snapshot
            </a>
          </div>
          <div className="tj-hero-meta">
            <span className="tj-mono">CAPABILITY · TRAJECTORY · OUTCOMES</span>
            <span className="tj-hero-meta-rule" />
            <span className="tj-mono">BUILT AROUND YOUR ORGANISATION</span>
          </div>
        </div>
      </div>
    </section>
  );
}
