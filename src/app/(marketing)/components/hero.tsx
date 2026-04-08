"use client";

import { useEffect, useState } from "react";

export function Hero() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const headline = "Map your people's capability and the trajectory you're on.";

  return (
    <section
      data-section="hero"
      className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 pb-16 pt-28 text-center sm:px-8 md:px-16 md:pb-20 md:pt-24 lg:px-24"
      style={{ backgroundColor: "var(--mk-primary-dark)" }}
    >
      <div className="w-full max-w-5xl">
        {/* Eyebrow — fades in first */}
        <p
          className="mk-eyebrow mb-6 transition-all duration-700"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
          }}
        >
          Assessments built for your organisation
        </p>

        {/* Headline — word-by-word reveal */}
        <h1
          className="font-[family-name:var(--font-display)] font-extrabold"
          style={{
            color: "var(--mk-text-on-dark)",
            fontSize: "clamp(2.35rem, 8vw, 4rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
          }}
        >
          {headline.split(" ").map((word, wordIdx) => (
            <span
              key={wordIdx}
              className="inline-block mr-[0.3em] transition-all duration-500"
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(20px)",
                transitionDelay: `${300 + wordIdx * 80}ms`,
              }}
            >
              {word}
            </span>
          ))}
        </h1>

        {/* Subtext */}
        <p
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed transition-all duration-700 sm:text-lg md:max-w-none md:whitespace-nowrap md:text-lg lg:text-xl"
          style={{
            color: "var(--mk-text-on-dark-muted)",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transitionDelay: "900ms",
          }}
        >
          Every organisation defines capability differently. Your assessment should too.
        </p>

        {/* CTA */}
        <a
          href="#contact"
          className="mt-8 inline-block rounded-full px-7 py-3 text-sm font-bold tracking-wide transition-all duration-200 hover:opacity-90"
          style={{
            backgroundColor: "var(--mk-accent)",
            color: "var(--mk-primary-dark)",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transitionDelay: "1100ms",
          }}
        >
          Start a conversation
        </a>
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 transition-opacity duration-500 md:bottom-8"
        style={{ opacity: revealed ? 1 : 0, transitionDelay: "1400ms" }}
      >
        <div
          className="h-8 w-px animate-pulse"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)" }}
        />
      </div>
    </section>
  );
}
