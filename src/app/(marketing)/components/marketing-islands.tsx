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

    function handleDeviceOrientation(e: DeviceOrientationEvent) {
      if (e.gamma === null || e.beta === null) return;

      const x = ((e.gamma + 45) / 90) * window.innerWidth;
      const y = ((e.beta - 20) / 70) * window.innerHeight;
      applyPosition(
        Math.max(0, Math.min(window.innerWidth, x)),
        Math.max(0, Math.min(window.innerHeight, y))
      );
    }

    function attachOrientationListener() {
      const DevOri = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };

      if (typeof DevOri.requestPermission === "function") {
        DevOri.requestPermission()
          .then((state) => {
            if (state === "granted") {
              window.addEventListener("deviceorientation", handleDeviceOrientation, {
                passive: true,
              });
            }
          })
          .catch(() => {});
      } else {
        window.addEventListener("deviceorientation", handleDeviceOrientation, {
          passive: true,
        });
      }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchstart", attachOrientationListener, {
      once: true,
      passive: true,
    });

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => setShowParticles(true));

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("deviceorientation", handleDeviceOrientation);
        window.cancelIdleCallback(idleId);
      };
    }

    const timer = globalThis.setTimeout(() => setShowParticles(true), 200);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
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
