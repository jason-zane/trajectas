"use client";

import { useScrollProgress } from "./use-scroll-progress";

const STAGES = [
  { num: "01", title: "Where you are now", desc: "Data without direction. Numbers that don\u2019t connect to decisions." },
  { num: "02", title: "Define the context", desc: "We learn your organisation. Your roles. Your definition of what good looks like." },
  { num: "03", title: "Build the instrument", desc: "A tailored assessment, grounded in psychometric methodology. Shaped by your requirements." },
  { num: "04", title: "Clarity", desc: "Insight that connects to decisions. Not just a score \u2014 a direction." },
];

function setJourneyStageVariables(
  element: HTMLDivElement | null,
  stageStart: number,
  direction: number
) {
  if (!element) return;

  element.style.setProperty("--stage-start", stageStart.toFixed(4));
  element.style.setProperty("--stage-dir", String(direction));
}

export function Journey() {
  const { ref } = useScrollProgress();

  return (
    <section
      ref={ref}
      data-section="journey"
      className="relative min-h-[250vh]"
    >
      <div className="journey-sticky sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* Central trajectory line — hidden on mobile */}
        <div className="absolute left-1/2 top-[10%] h-[80%] w-px -translate-x-1/2 hidden md:block">
          <div className="journey-line w-full origin-top" />
        </div>

        {/* Stages */}
        <div className="journey-list relative flex h-[70%] w-full max-w-4xl flex-col justify-between px-4 md:px-8">
          {STAGES.map((stage, i) => {
            const stageStart = i * 0.25;
            const isLeft = i % 2 === 0;

            return (
              <div
                key={i}
                ref={(element) =>
                  setJourneyStageVariables(element, stageStart, isLeft ? -1 : 1)
                }
                className={`journey-stage relative flex items-center ${isLeft ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-xs md:max-w-sm ${isLeft ? "text-right" : "text-left"}`}
                >
                  <div className="mk-mono text-[var(--mk-accent)]">
                    {stage.num}
                  </div>
                  <h3 className="journey-title mt-1 text-lg font-bold md:text-xl">
                    {stage.title}
                  </h3>
                  <p className="journey-desc mk-body mt-2">{stage.desc}</p>
                </div>

                {/* Dot on center line — hidden on mobile */}
                <div className="journey-dot absolute left-1/2 hidden md:block" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
