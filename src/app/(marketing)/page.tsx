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

  // Direct DOM pointer/tilt tracking — bypasses React batching so it works immediately
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    function applyPosition(x: number, y: number) {
      mouseRef.current = { x, y };
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
      }
    }

    // Desktop: mouse
    function handleMouseMove(e: MouseEvent) {
      applyPosition(e.clientX, e.clientY);
    }

    // Mobile: touch drag moves the glow/particles with your finger
    function handleTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (t) applyPosition(t.clientX, t.clientY);
    }

    // Mobile: device tilt creates ambient particle movement (accelerometer)
    function handleDeviceOrientation(e: DeviceOrientationEvent) {
      if (e.gamma === null || e.beta === null) return;
      // gamma: left-right tilt (-90→90), typical hand-held range ~-35→35
      // beta: front-back tilt (-180→180), typical held range ~30→80
      const x = ((e.gamma + 45) / 90) * window.innerWidth;
      const y = ((e.beta - 20) / 70) * window.innerHeight;
      applyPosition(
        Math.max(0, Math.min(window.innerWidth, x)),
        Math.max(0, Math.min(window.innerHeight, y))
      );
    }

    function attachOrientationListener() {
      // iOS 13+ requires explicit permission via a user gesture
      const DevOri = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DevOri.requestPermission === "function") {
        DevOri.requestPermission()
          .then((state) => {
            if (state === "granted") {
              window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
            }
          })
          .catch(() => {/* permission denied — silent */});
      } else {
        window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
      }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    // Request orientation on first touch so the iOS permission dialog fires via a user gesture
    window.addEventListener("touchstart", attachOrientationListener, { once: true, passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    };
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
