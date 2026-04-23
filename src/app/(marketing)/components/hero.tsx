import type { CSSProperties } from "react";

const HEADLINE = "Map your people's capability and the trajectory you're on.";

export function Hero() {
  return (
    <section
      data-section="hero"
      className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 pb-16 pt-28 text-center sm:px-8 md:px-16 md:pb-20 md:pt-24 lg:px-24"
      style={{ backgroundColor: "var(--mk-primary-dark)" }}
    >
      <div className="w-full max-w-5xl">
        <p className="mk-eyebrow hero-eyebrow mb-6">
          Assessments built for your organisation
        </p>

        <h1
          className="font-[family-name:var(--font-display)] font-extrabold"
          style={{
            color: "var(--mk-text-on-dark)",
            fontSize: "clamp(2.35rem, 8vw, 4rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
          }}
        >
          {HEADLINE.split(" ").map((word, wordIdx) => (
            <span
              key={wordIdx}
              className="hero-word inline-block mr-[0.3em]"
              style={{ "--hero-word-index": wordIdx } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h1>

        <p
          className="hero-subtext mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg md:max-w-none md:whitespace-nowrap md:text-lg lg:text-xl"
          style={{ color: "var(--mk-text-on-dark-muted)" }}
        >
          Every organisation defines capability differently. Your assessment should too.
        </p>

        <a
          href="#contact"
          className="hero-cta mt-8 inline-block rounded-full px-7 py-3 text-sm font-bold tracking-wide transition-opacity duration-200 hover:opacity-90"
          style={{
            backgroundColor: "var(--mk-accent)",
            color: "var(--mk-primary-dark)",
          }}
        >
          Start a conversation
        </a>
      </div>

      <div className="hero-scroll-hint absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-8">
        <div
          className="h-8 w-px animate-pulse"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)",
          }}
        />
      </div>
    </section>
  );
}
