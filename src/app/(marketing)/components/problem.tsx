"use client";

import { useScrollProgress } from "./use-scroll-progress";

const GENERIC_PHRASES = [
  "Standardised frameworks.",
  "One-size-fits-all models.",
  "Off-the-shelf benchmarks.",
  "Generic personality tests.",
];

const REFORMED_PHRASES = [
  "Your organisational context.",
  "Your definition of capability.",
  "Assessment built around you.",
  "Measurement tied to outcomes.",
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
      className="problem-section relative"
    >
      <div className="problem-sticky flex flex-col items-center justify-center px-5 md:px-8">
        {/* Generic text — dissolves as progress goes 0 → 0.5 */}
        <div className="problem-layer absolute inset-0 flex flex-col items-center justify-center gap-3 md:gap-4">
          <p className="mk-eyebrow problem-heading-generic mb-3 text-center md:mb-5">
            Legacy Assessment Providers
          </p>
          {GENERIC_PHRASES.map((phrase, phraseIdx) => (
            <div
              key={phraseIdx}
              className="problem-line problem-generic-phrase flex flex-wrap justify-center"
            >
              {phrase.split("").map((char, charIdx) => {
                const delay = (phraseIdx * 4 + charIdx) / 100;
                const direction = charIdx % 2 === 0 ? 1 : -1;

                return (
                  <span
                    key={charIdx}
                    ref={(element) =>
                      setProblemCharVariables(element, delay, direction)
                    }
                    className="problem-char-generic inline-block text-xl font-bold sm:text-2xl md:text-4xl"
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* Reformed text — assembles as progress goes 0.5 → 1 */}
        <div className="problem-layer absolute inset-0 flex flex-col items-center justify-center gap-3 md:gap-4">
          <p className="mk-eyebrow problem-heading-reformed mb-3 text-center md:mb-5">
            The Trajectas Difference
          </p>
          {REFORMED_PHRASES.map((phrase, phraseIdx) => (
            <div
              key={phraseIdx}
              className="problem-line problem-reformed-phrase mx-auto flex w-fit max-w-full flex-wrap justify-center"
            >
              {phrase.split("").map((char, charIdx) => {
                const delay = (phraseIdx * 4 + charIdx) / 100;
                const direction = charIdx % 2 === 0 ? 1 : -1;

                return (
                  <span
                    key={charIdx}
                    ref={(element) =>
                      setProblemCharVariables(element, delay, direction)
                    }
                    className="problem-char-reformed inline-block text-xl font-bold sm:text-2xl md:text-4xl"
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
