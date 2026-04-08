"use client";

import { useEffect, useState } from "react";
import { ParticleMesh } from "./components/particle-mesh";
import { useMousePosition } from "./components/use-mouse-position";
import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { Problem } from "./components/problem";
import { Journey } from "./components/journey";
import { BuiltFor } from "./components/built-for";
import { Contact } from "./components/contact";

const SECTIONS = ["hero", "problem", "journey", "builtFor", "contact"] as const;

export default function MarketingPage() {
  const mouse = useMousePosition();
  const [activeSection, setActiveSection] = useState<string>("hero");

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

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <>
      <ParticleMesh activeSection={activeSection} mousePosition={mouse} />
      {/* Subtle cursor glow — warm golden shimmer that follows the mouse */}
      <div
        className="pointer-events-none fixed left-0 top-0 z-[15] h-[600px] w-[600px]"
        style={{
          transform: `translate(calc(${mouse.x}px - 50%), calc(${mouse.y}px - 50%))`,
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
