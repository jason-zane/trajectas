"use client";

import { useScrollProgress } from "./use-scroll-progress";

const STAGES = [
  {
    num: "01",
    title: "Where you are",
    desc: "Numbers without context. Data that doesn't connect to performance or outcomes.",
  },
  {
    num: "02",
    title: "Your context",
    desc: "Your organisation. Your roles. The capabilities that drive performance in your environment.",
  },
  {
    num: "03",
    title: "Build the instrument",
    desc: "A psychometrically rigorous assessment, calibrated to the capabilities your roles actually demand.",
  },
  {
    num: "04",
    title: "Outcomes",
    desc: "Capability mapped to performance. Insight that reveals trajectory — not just a score.",
  },
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
            const isFinal = i === STAGES.length - 1;

            // Stage 4 (Outcomes) centred on desktop; all centred on mobile
            const justifyClass = isFinal
              ? "justify-center"
              : `justify-center md:${isLeft ? "justify-start" : "justify-end"}`;
            const textClass = isFinal
              ? "text-center"
              : `text-center md:${isLeft ? "text-right" : "text-left"}`;

            return (
              <div
                key={i}
                ref={(element) =>
                  setJourneyStageVariables(element, stageStart, isLeft ? -1 : 1)
                }
                className={`journey-stage relative flex items-center ${justifyClass}`}
              >
                <div className={`max-w-xs md:max-w-sm ${textClass}`}>
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
