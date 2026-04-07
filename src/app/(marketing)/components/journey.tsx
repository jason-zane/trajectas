"use client";

import { useScrollProgress } from "./use-scroll-progress";

const STAGES = [
  { num: "01", title: "Where you are now", desc: "Data without direction. Numbers that don\u2019t connect to decisions." },
  { num: "02", title: "Define the context", desc: "We learn your organisation. Your roles. Your definition of what good looks like." },
  { num: "03", title: "Build the instrument", desc: "A tailored assessment, grounded in psychometric methodology. Shaped by your requirements." },
  { num: "04", title: "Clarity", desc: "Insight that connects to decisions. Not just a score \u2014 a direction." },
];

export function Journey() {
  const { ref, progress } = useScrollProgress();

  return (
    <section ref={ref} data-section="journey" className="relative" style={{ minHeight: "350vh" }}>
      <div
        className="sticky top-0 flex h-screen items-center justify-center overflow-hidden"
        style={{
          background: `color-mix(in srgb, var(--mk-bg) ${Math.round((1 - progress) * 100)}%, var(--mk-primary-dark))`,
        }}
      >
        {/* Central trajectory line — hidden on mobile */}
        <div className="absolute left-1/2 top-[10%] h-[80%] w-px -translate-x-1/2 hidden md:block">
          <div
            className="w-full origin-top"
            style={{
              height: `${Math.min(100, progress * 120)}%`,
              background: "var(--mk-accent)",
              opacity: 0.3,
            }}
          />
        </div>

        {/* Stages */}
        <div className="relative flex h-[70%] w-full max-w-4xl flex-col justify-between px-4 md:px-8">
          {STAGES.map((stage, i) => {
            const stageStart = i * 0.25;
            const stageProgress = Math.max(0, Math.min(1, (progress - stageStart) / 0.2));
            const isLeft = i % 2 === 0;
            const isLightBg = progress < 0.5;

            return (
              <div
                key={i}
                className="flex items-center md:items-center"
                style={{
                  justifyContent: isLeft ? "flex-start" : "flex-end",
                  opacity: stageProgress,
                  transform: `translateX(${(isLeft ? -1 : 1) * (1 - stageProgress) * 30}px)`,
                }}
              >
                <div className="max-w-xs md:max-w-sm" style={{ textAlign: isLeft ? "right" : "left" }}>
                  <div className="mk-mono" style={{ color: "var(--mk-accent)" }}>{stage.num}</div>
                  <h3
                    className="mt-1 text-lg font-bold md:text-xl"
                    style={{ color: isLightBg ? "var(--mk-text)" : "var(--mk-text-on-dark)" }}
                  >
                    {stage.title}
                  </h3>
                  <p
                    className="mk-body mt-2"
                    style={{ color: isLightBg ? "var(--mk-text-muted)" : "var(--mk-text-on-dark-muted)" }}
                  >
                    {stage.desc}
                  </p>
                </div>

                {/* Dot on center line — hidden on mobile */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 hidden md:block"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "2px solid var(--mk-accent)",
                    opacity: stageProgress,
                    background: stageProgress > 0.8 ? "var(--mk-accent)" : "transparent",
                    transition: "background 0.3s",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
