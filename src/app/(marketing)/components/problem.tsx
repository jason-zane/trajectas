"use client";

import { useScrollProgress } from "./use-scroll-progress";

const GENERIC_PHRASES = [
  "Standardised frameworks",
  "Percentile scores",
  "Off-the-shelf benchmarks",
  "Generic personality tests",
];

const REFORMED_PHRASES = [
  "Your context",
  "Your definition of capability",
  "Assessment built around you",
  "Measurement that drives outcomes",
];

function setProblemCharVariables(
  element: HTMLSpanElement | null,
  delay: number,
  direction: number
) {
  if (!element) return;

  element.style.setProperty("--char-delay", delay.toFixed(4));
  element.style.setProperty("--char-dir", String(direction));
}

export function Problem() {
  const { ref } = useScrollProgress();

  return (
    <section
      ref={ref}
      data-section="problem"
      aria-label="Why generic assessment fails — and what replaces it"
      className="relative min-h-[200vh]"
    >
      <div className="problem-sticky sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-8">
        {/* Generic text — dissolves as progress goes 0 → 0.5 */}
        <div className="problem-layer absolute inset-0 flex flex-col items-center justify-center gap-4">
          {GENERIC_PHRASES.map((phrase, phraseIdx) => (
            <div key={phraseIdx} className="problem-line flex flex-wrap justify-center">
              {phrase.split("").map((char, charIdx) => {
                const delay = (phraseIdx * 4 + charIdx) / 100;
                const direction = charIdx % 2 === 0 ? 1 : -1;

                return (
                  <span
                    key={charIdx}
                    ref={(element) =>
                      setProblemCharVariables(element, delay, direction)
                    }
                    className="problem-char-generic inline-block text-2xl font-bold md:text-4xl"
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* Reformed text — assembles as progress goes 0.5 → 1 */}
        <div className="problem-layer absolute inset-0 flex flex-col items-center justify-center gap-4">
          {REFORMED_PHRASES.map((phrase, phraseIdx) => (
            <div key={phraseIdx} className="problem-line problem-reformed-phrase flex flex-wrap justify-center">
              {phrase.split("").map((char, charIdx) => {
                const delay = (phraseIdx * 4 + charIdx) / 100;

                return (
                  <span
                    key={charIdx}
                    ref={(element) =>
                      setProblemCharVariables(element, delay, 1)
                    }
                    className="problem-char-reformed inline-block font-[family-name:var(--font-display)] font-bold text-2xl md:text-4xl"
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
