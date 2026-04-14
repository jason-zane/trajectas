"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ParticleMesh } from "./particle-mesh";

const SECTIONS = ["hero", "problem", "journey", "builtFor", "contact"] as const;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function MarketingInteractive() {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
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

  useEffect(() => {
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
