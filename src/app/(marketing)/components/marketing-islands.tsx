"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getPrefersReducedMotion,
  subscribePrefersReducedMotion,
  supportsIntersectionObserver,
} from "./motion-support";

const ParticleMesh = dynamic(
  () => import("./particle-mesh").then((mod) => mod.ParticleMesh),
  { ssr: false },
);

const SECTIONS = [
  "hero",
  "problem",
  "journey",
  "science",
  "try",
  "builtFor",
  "compare",
  "contact",
] as const;

export function MarketingInteractive() {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const reducedMotion = useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotion,
    () => false,
  );
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    if (reducedMotion) return;

    function applyPosition(x: number, y: number) {
      mouseRef.current = { x, y };
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
      }
    }

    function handleMouseMove(e: MouseEvent) {
      applyPosition(e.clientX, e.clientY);
    }

    function handleTouchMove(e: TouchEvent) {
      const touch = e.touches[0];
      if (touch) {
        applyPosition(touch.clientX, touch.clientY);
      }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [reducedMotion]);

  // Promote the marketing surface to its animated layout once JS has hydrated
  // and the user hasn't opted out of motion. The default static layout stays
  // in place if either of those is false — the page is always readable.
  useEffect(() => {
    const root = document.querySelector('[data-surface="marketing"]');
    if (!root) return;
    if (reducedMotion) {
      root.removeAttribute("data-motion");
      return;
    }
    root.setAttribute("data-motion", "on");
    return () => {
      root.removeAttribute("data-motion");
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!supportsIntersectionObserver()) {
      let rafId = 0;

      function updateActiveSection() {
        rafId = 0;
        const viewportCenter = window.innerHeight / 2;
        let nextSection = "hero";
        let closestDistance = Number.POSITIVE_INFINITY;

        SECTIONS.forEach((section) => {
          const el = document.querySelector(`[data-section="${section}"]`);
          if (!el) return;

          const rect = el.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;

          const distance = Math.abs(
            rect.top + rect.height / 2 - viewportCenter,
          );
          if (distance < closestDistance) {
            closestDistance = distance;
            nextSection = section;
          }
        });

        setActiveSection(nextSection);
      }

      function scheduleUpdate() {
        if (rafId !== 0) return;
        rafId = window.requestAnimationFrame(updateActiveSection);
      }

      updateActiveSection();
      window.addEventListener("scroll", scheduleUpdate, { passive: true });
      window.addEventListener("resize", scheduleUpdate);
      return () => {
        window.removeEventListener("scroll", scheduleUpdate);
        window.removeEventListener("resize", scheduleUpdate);
        if (rafId !== 0) cancelAnimationFrame(rafId);
      };
    }

    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach((section) => {
      const el = document.querySelector(`[data-section="${section}"]`);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(section);
          }
        },
        { threshold: 0.3 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  return (
    <>
      {!reducedMotion ? (
        <ParticleMesh activeSection={activeSection} mouseRef={mouseRef} />
      ) : null}
      <div
        ref={glowRef}
        className="pointer-events-none fixed left-0 top-0 z-[15] h-[600px] w-[600px]"
        style={{
          transform: "translate(-9999px, -9999px)",
          background:
            "radial-gradient(circle, rgba(201,169,98,0.05) 0%, transparent 65%)",
        }}
      />
    </>
  );
}
