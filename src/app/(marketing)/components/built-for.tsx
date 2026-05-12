"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  getPrefersReducedMotion,
  supportsIntersectionObserver,
} from "./motion-support";

function isElementInView(element: HTMLElement, threshold: number) {
  const rect = element.getBoundingClientRect();
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  return (
    rect.top < viewportHeight * (1 - threshold) &&
    rect.bottom > viewportHeight * threshold
  );
}

function useRevealOnEnter(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (getPrefersReducedMotion() || !supportsIntersectionObserver()) {
      return;
    }

    const alreadyVisible = isElementInView(element, threshold);
    const frameId = requestAnimationFrame(() => {
      setVisible(alreadyVisible);
      setEnhanced(true);
    });

    if (alreadyVisible) {
      return () => cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(element);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [threshold]);

  return { ref, enhanced, visible: !enhanced || visible };
}

function HiringVisual({ animate }: { animate: boolean }) {
  const center = { x: 160, y: 160 };
  const satellites = [
    { x: 70, y: 60, r: 10 },
    { x: 260, y: 55, r: 8 },
    { x: 280, y: 180, r: 9 },
    { x: 230, y: 275, r: 7 },
    { x: 60, y: 250, r: 8 },
  ];

  return (
    <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden="true">
      {satellites.map((sat, i) => {
        const length = Math.hypot(sat.x - center.x, sat.y - center.y);

        return (
          <line
            key={`line-${i}`}
            x1={center.x}
            y1={center.y}
            x2={sat.x}
            y2={sat.y}
            stroke="var(--mk-primary)"
            strokeWidth={1.5}
            strokeOpacity={0.3}
            strokeDasharray={`${length}`}
            strokeDashoffset={animate ? 0 : length}
            style={{
              transition: `stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1) ${
                0.3 + i * 0.12
              }s`,
            }}
          />
        );
      })}

      {[
        [0, 1],
        [1, 2],
        [3, 4],
      ].map(([a, b], i) => {
        const from = satellites[a];
        const to = satellites[b];
        const length = Math.hypot(to.x - from.x, to.y - from.y);

        return (
          <line
            key={`inter-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="var(--mk-accent)"
            strokeWidth={1}
            strokeOpacity={0.15}
            strokeDasharray={`${length}`}
            strokeDashoffset={animate ? 0 : length}
            style={{
              transition: `stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1) ${
                0.8 + i * 0.15
              }s`,
            }}
          />
        );
      })}

      <circle
        cx={center.x}
        cy={center.y}
        r={animate ? 18 : 0}
        fill="var(--mk-primary)"
        fillOpacity={0.15}
        stroke="var(--mk-primary)"
        strokeWidth={2}
        strokeOpacity={0.5}
        style={{
          transition: "r 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s",
          transformOrigin: `${center.x}px ${center.y}px`,
        }}
      />
      <circle
        cx={center.x}
        cy={center.y}
        r={animate ? 6 : 0}
        fill="var(--mk-accent)"
        fillOpacity={0.9}
        style={{
          transition: "r 0.5s cubic-bezier(0.22,1,0.36,1) 0.15s",
        }}
      />

      {satellites.map((sat, i) => (
        <circle
          key={`sat-${i}`}
          cx={sat.x}
          cy={sat.y}
          r={animate ? sat.r : 0}
          fill="var(--mk-primary)"
          fillOpacity={0.6}
          style={{
            transition: `r 0.5s cubic-bezier(0.22,1,0.36,1) ${
              0.4 + i * 0.1
            }s`,
          }}
        />
      ))}
    </svg>
  );
}

function CapabilityVisual({ animate }: { animate: boolean }) {
  const nodes = [
    { x: 80, y: 80, r: 12, opacity: 0.9 },
    { x: 200, y: 60, r: 10, opacity: 0.85 },
    { x: 260, y: 150, r: 9, opacity: 0.3 },
    { x: 180, y: 200, r: 11, opacity: 0.8 },
    { x: 60, y: 220, r: 8, opacity: 0.25 },
    { x: 140, y: 120, r: 10, opacity: 0.7 },
  ];

  const connections: { from: number; to: number; dashed: boolean }[] = [
    { from: 0, to: 1, dashed: false },
    { from: 0, to: 5, dashed: false },
    { from: 1, to: 2, dashed: true },
    { from: 1, to: 5, dashed: false },
    { from: 2, to: 3, dashed: true },
    { from: 3, to: 4, dashed: true },
    { from: 3, to: 5, dashed: false },
    { from: 4, to: 0, dashed: true },
  ];

  return (
    <svg viewBox="0 0 320 300" className="h-full w-full" aria-hidden="true">
      {connections.map((conn, i) => {
        const a = nodes[conn.from];
        const b = nodes[conn.to];
        const length = Math.hypot(b.x - a.x, b.y - a.y);

        return (
          <line
            key={`conn-${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={conn.dashed ? "var(--mk-text-muted)" : "var(--mk-primary)"}
            strokeWidth={conn.dashed ? 1 : 1.5}
            strokeOpacity={conn.dashed ? 0.2 : 0.3}
            strokeDasharray={conn.dashed ? "4 4" : `${length}`}
            strokeDashoffset={animate ? 0 : conn.dashed ? 0 : length}
            style={{
              opacity: animate ? 1 : 0,
              transition: `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${
                0.2 + i * 0.06
              }s, stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1) ${
                0.3 + i * 0.08
              }s`,
            }}
          />
        );
      })}

      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          {node.opacity > 0.5 ? (
            <circle
              cx={node.x}
              cy={node.y}
              r={animate ? node.r + 4 : 0}
              fill="var(--mk-primary)"
              fillOpacity={0.08}
              style={{
                transition: `r 0.6s cubic-bezier(0.22,1,0.36,1) ${
                  0.5 + i * 0.1
                }s`,
              }}
            />
          ) : null}
          <circle
            cx={node.x}
            cy={node.y}
            r={animate ? node.r : 0}
            fill={
              node.opacity > 0.5 ? "var(--mk-primary)" : "var(--mk-text-muted)"
            }
            fillOpacity={node.opacity}
            stroke={
              node.opacity > 0.5 ? "var(--mk-primary)" : "var(--mk-text-muted)"
            }
            strokeWidth={node.opacity > 0.5 ? 0 : 1}
            strokeOpacity={0.4}
            strokeDasharray={node.opacity > 0.5 ? undefined : "3 3"}
            style={{
              transition: `r 0.5s cubic-bezier(0.22,1,0.36,1) ${
                0.4 + i * 0.1
              }s`,
            }}
          />
        </g>
      ))}
    </svg>
  );
}

interface PanelProps {
  eyebrow: string;
  title: string;
  body: string;
  reverse: boolean;
  visual: (animate: boolean) => ReactElement;
}

function Panel({ eyebrow, title, body, reverse, visual }: PanelProps) {
  const { ref, enhanced, visible } = useRevealOnEnter(0.2);

  return (
    <div
      ref={ref}
      data-reveal={visible ? "visible" : "pending"}
      className={`builtfor-panel flex min-h-[80vh] w-full items-center px-6 py-24 md:px-16 lg:px-24 ${
        reverse
          ? "flex-col-reverse md:flex-row-reverse"
          : "flex-col-reverse md:flex-row"
      } gap-12 md:gap-20`}
      style={
        enhanced
          ? {
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(40px)",
              transition:
                "opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)",
            }
          : undefined
      }
    >
      <div className="flex-1 max-w-xl">
        <span className="mk-eyebrow">{eyebrow}</span>
        <h2
          className="mk-headline mt-4 font-[family-name:var(--font-display)]"
          style={{ color: "var(--mk-text)" }}
        >
          {title}
        </h2>
        <p className="mk-body mt-6" style={{ color: "var(--mk-text-muted)" }}>
          {body}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center max-w-sm md:max-w-md w-full">
        {visual(visible)}
      </div>
    </div>
  );
}

export function BuiltFor() {
  return (
    <section
      data-section="builtFor"
      className="relative"
      style={{ background: "var(--mk-bg)" }}
    >
      <div className="mx-auto max-w-4xl px-6 pt-32 text-center">
        <span className="mk-eyebrow">Built for</span>
        <h2
          className="mk-headline mt-4 font-[family-name:var(--font-display)]"
          style={{ color: "var(--mk-text)" }}
        >
          Built for decisions that matter
        </h2>
      </div>

      <div className="mx-auto max-w-7xl">
        <Panel
          eyebrow="Use case"
          title="Hiring for critical roles"
          body="When a bad hire costs years, not months. Assess candidates against the capabilities your role actually demands — and identify who has the trajectory to perform."
          reverse={false}
          visual={(animate) => <HiringVisual animate={animate} />}
        />
      </div>

      <div className="mx-auto max-w-7xl pb-32">
        <Panel
          eyebrow="Use case"
          title="Capability mapping"
          body="Map your people against the capabilities that drive outcomes in your organisation. See where strengths concentrate and gaps hide — then connect results to performance."
          reverse={true}
          visual={(animate) => <CapabilityVisual animate={animate} />}
        />
      </div>
    </section>
  );
}
