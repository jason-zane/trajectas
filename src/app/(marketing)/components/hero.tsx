"use client";

import { useEffect, useState } from "react";

export function Hero() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const lines = [
    "Generic assessment",
    "measures nothing that matters.",
  ];

  return (
    <section
      data-section="hero"
      className="relative z-10 flex h-screen flex-col items-center justify-center px-8 md:px-16 lg:px-24 text-center"
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
          Contextual Assessment
        </p>

        {/* Headline — line-by-line reveal, two explicit lines */}
        <h1
          className="mk-display font-[family-name:var(--font-display)]"
          style={{ color: "var(--mk-text-on-dark)" }}
        >
          {lines.map((line, lineIdx) => (
            <span key={lineIdx} className="block">
              {line.split(" ").map((word, wordIdx) => {
                const globalIdx = lines.slice(0, lineIdx).flatMap(l => l.split(" ")).length + wordIdx;
                return (
                  <span
                    key={wordIdx}
                    className="inline-block mr-[0.3em] transition-all duration-500"
                    style={{
                      opacity: revealed ? 1 : 0,
                      transform: revealed ? "translateY(0)" : "translateY(20px)",
                      transitionDelay: `${300 + globalIdx * 80}ms`,
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </span>
          ))}
        </h1>

        {/* Subtext */}
        <p
          className="mk-body mt-6 max-w-lg mx-auto text-xl leading-relaxed transition-all duration-700"
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
        className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500"
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
