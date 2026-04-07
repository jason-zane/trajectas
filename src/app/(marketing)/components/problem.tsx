"use client";

import { useMemo } from "react";
import { useScrollProgress } from "./use-scroll-progress";

const GENERIC_PHRASES = [
  "Standardised competency frameworks",
  "Norm-referenced percentile scores",
  "One-size-fits-all benchmarks",
  "Industry-standard personality profiles",
];

const REFORMED_PHRASES = [
  "Your context",
  "Your definition of capability",
  "Measurement that drives decisions",
  "Assessment that actually means something",
];

export function Problem() {
  const { ref, progress } = useScrollProgress();

  const bgColor = useMemo(() => {
    const t = Math.max(0, Math.min(1, progress));
    return t < 0.5 ? "var(--mk-primary-dark)" : "var(--mk-bg)";
  }, [progress]);

  return (
    <section
      ref={ref}
      data-section="problem"
      aria-label="Why generic assessment fails — and what replaces it"
      className="relative"
      style={{ minHeight: "200vh" }}
    >
      <div
        className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-8"
        style={{ backgroundColor: bgColor, transition: "background-color 0.3s ease" }}
      >
        {/* Generic text — dissolves as progress goes 0 → 0.5 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {GENERIC_PHRASES.map((phrase, phraseIdx) => (
            <div key={phraseIdx} className="flex flex-wrap justify-center">
              {phrase.split("").map((char, charIdx) => {
                const charProgress = progress * 2; // 0–1 over first half
                const delay = (phraseIdx * 30 + charIdx * 2) / 150;
                const charOpacity = Math.max(0, 1 - (charProgress - delay) * 3);
                const yOffset = charProgress > delay ? -(charProgress - delay) * 60 : 0;
                const blur = charProgress > delay ? (charProgress - delay) * 8 : 0;

                return (
                  <span
                    key={charIdx}
                    className="inline-block text-2xl font-bold md:text-4xl"
                    style={{
                      color: progress < 0.5 ? "var(--mk-text-muted)" : "transparent",
                      opacity: charOpacity,
                      transform: `translateY(${yOffset}px)`,
                      filter: `blur(${blur}px)`,
                      transition: "color 0.3s",
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* Reformed text — assembles as progress goes 0.5 → 1 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {REFORMED_PHRASES.map((phrase, phraseIdx) => (
            <div key={phraseIdx} className="flex flex-wrap justify-center">
              {phrase.split("").map((char, charIdx) => {
                const assembleProgress = (progress - 0.5) * 2;
                const delay = (phraseIdx * 20 + charIdx * 2) / 100;
                const charOpacity = Math.max(0, Math.min(1, (assembleProgress - delay) * 3));
                const yOffset = assembleProgress > delay ? 0 : 12;
                const blur = assembleProgress > delay ? 0 : 4;

                return (
                  <span
                    key={charIdx}
                    className="inline-block font-[family-name:var(--font-display)] text-2xl md:text-4xl"
                    style={{
                      color: "var(--mk-primary)",
                      opacity: charOpacity,
                      transform: `translateY(${yOffset}px)`,
                      filter: `blur(${blur}px)`,
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
