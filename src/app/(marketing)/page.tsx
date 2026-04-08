"use client";

import { useEffect, useRef, useState } from "react";
import { ParticleMesh } from "./components/particle-mesh";
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { Problem } from "./components/problem";
import { Journey } from "./components/journey";
import { BuiltFor } from "./components/built-for";
import { Contact } from "./components/contact";

const SECTIONS = ["hero", "problem", "journey", "builtFor", "contact"] as const;

export default function MarketingPage() {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const glowRef = useRef<HTMLDivElement>(null);
  // Shared mouse ref — updated imperatively, no React re-renders
  const mouseRef = useRef({ x: -9999, y: -9999 });

  // Direct DOM mouse tracking — bypasses React batching so it works immediately
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
      }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach((section) => {
      const el = document.querySelector(`[data-section="${section}"]`);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(section);
        },
        { threshold: 0.3 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <>
      <ParticleMesh activeSection={activeSection} mouseRef={mouseRef} />
      {/* Subtle cursor glow — warm golden shimmer, updated imperatively */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed left-0 top-0 z-[15] h-[600px] w-[600px]"
        style={{
          transform: "translate(-9999px, -9999px)",
          background: "radial-gradient(circle, rgba(201,169,98,0.05) 0%, transparent 65%)",
        }}
      />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <Problem />
        <Journey />
        <BuiltFor />
        <Contact />
      </main>
    </>
  );
}
