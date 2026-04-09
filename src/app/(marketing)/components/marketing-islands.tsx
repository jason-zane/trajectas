"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const SECTIONS = ["hero", "problem", "journey", "builtFor", "contact"] as const;

const ParticleMesh = dynamic(
  () => import("./particle-mesh").then((mod) => mod.ParticleMesh),
  { ssr: false }
);

export function MarketingInteractive() {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [showParticles, setShowParticles] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

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

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => setShowParticles(true));

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("touchmove", handleTouchMove);
        window.cancelIdleCallback(idleId);
      };
    }

    const timer = globalThis.setTimeout(() => setShowParticles(true), 200);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      globalThis.clearTimeout(timer);
    };
  }, []);

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
      {showParticles ? (
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
