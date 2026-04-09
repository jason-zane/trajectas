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
      className="relative min-h-[350vh]"
    >
      <div className="journey-sticky sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden">
        {/* Central trajectory line — hidden on mobile */}
        <div className="absolute left-1/2 top-[10%] h-[80%] w-px -translate-x-1/2 hidden md:block">
          <div className="journey-line w-full origin-top" />
        </div>

        {/* Stages */}
        <div className="journey-list relative flex w-full max-w-4xl flex-col gap-8 px-5 py-12 md:h-[70%] md:justify-between md:gap-0 md:px-8 md:py-0">
          {STAGES.map((stage, i) => {
            const stageStart = i * 0.18;
            const isLeft = i % 2 === 0;
            const contentClass = isLeft
              ? "md:col-start-1 md:justify-self-end md:pr-10 md:text-right"
              : "md:col-start-3 md:justify-self-start md:pl-10 md:text-left";

            return (
              <div
                key={i}
                ref={(element) =>
                  setJourneyStageVariables(element, stageStart, isLeft ? -1 : 1)
                }
                className="journey-stage relative grid w-full grid-cols-1 place-items-center md:grid-cols-[minmax(0,1fr)_0_minmax(0,1fr)]"
              >
                <div
                  className={`max-w-[19rem] text-center md:w-full md:max-w-sm ${contentClass}`}
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
