"use client";

import { useCallback, useEffect, useRef } from "react";
import { SECTION_CONFIGS, type ParticleConfig } from "./particle-config";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseOpacity: number;
  phase: number; // For breathing oscillation
}

interface ParticleMeshProps {
  activeSection: string;
  mousePosition: { x: number; y: number };
}

/** Lerp between two configs for smooth section transitions */
function lerpConfig(
  a: ParticleConfig,
  b: ParticleConfig,
  t: number,
): ParticleConfig {
  const l = (v1: number, v2: number) => v1 + (v2 - v1) * t;
  return {
    count: Math.round(l(a.count, b.count)),
    colour: t < 0.5 ? a.colour : b.colour,
    lineColour: t < 0.5 ? a.lineColour : b.lineColour,
    connectionDistance: l(a.connectionDistance, b.connectionDistance),
    speed: l(a.speed, b.speed),
    mouseRadius: l(a.mouseRadius, b.mouseRadius),
    mouseStrength: l(a.mouseStrength, b.mouseStrength),
    sizeRange: [
      l(a.sizeRange[0], b.sizeRange[0]),
      l(a.sizeRange[1], b.sizeRange[1]),
    ],
    opacityRange: [
      l(a.opacityRange[0], b.opacityRange[0]),
      l(a.opacityRange[1], b.opacityRange[1]),
    ],
  };
}

export function ParticleMesh({
  activeSection,
  mousePosition,
}: ParticleMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const mouseRef = useRef(mousePosition);

  // Config transition state
  const prevConfigRef = useRef<ParticleConfig>(SECTION_CONFIGS.hero);
  const targetConfigRef = useRef<ParticleConfig>(SECTION_CONFIGS.hero);
  const currentConfigRef = useRef<ParticleConfig>(SECTION_CONFIGS.hero);
  const transitionStartRef = useRef(0);
  const transitionDuration = 600;

  // eslint-disable-next-line react-hooks/refs -- render-time sync keeps the animation loop on the latest mouse position
  mouseRef.current = mousePosition;

  // Smooth config transition when section changes
  useEffect(() => {
    const next = SECTION_CONFIGS[activeSection] ?? SECTION_CONFIGS.hero;
    if (next !== targetConfigRef.current) {
      prevConfigRef.current = { ...currentConfigRef.current };
      targetConfigRef.current = next;
      transitionStartRef.current = performance.now();
    }
  }, [activeSection]);

  const initParticles = useCallback((width: number, height: number) => {
    const config = targetConfigRef.current;
    const particles: Particle[] = [];
    for (let i = 0; i < config.count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * config.speed,
        vy: (Math.random() - 0.5) * config.speed,
        radius:
          config.sizeRange[0] +
          Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
        baseOpacity:
          config.opacityRange[0] +
          Math.random() * (config.opacityRange[1] - config.opacityRange[0]),
        phase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.scale(dpr, dpr);
      initParticles(window.innerWidth, window.innerHeight);
    }

    resize();
    window.addEventListener("resize", resize);

    function animate(now: number) {
      // Lerp config transition (ease-out cubic)
      const elapsed = now - transitionStartRef.current;
      const t = Math.min(1, elapsed / transitionDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      currentConfigRef.current = lerpConfig(
        prevConfigRef.current,
        targetConfigRef.current,
        eased,
      );

      const config = currentConfigRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx!.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < config.mouseRadius && dist > 0) {
          const force =
            (1 - dist / config.mouseRadius) * config.mouseStrength;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.vx += (Math.random() - 0.5) * 0.02 * config.speed;
        p.vy += (Math.random() - 0.5) * 0.02 * config.speed;

        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Breathing: slow opacity oscillation
        const breath = Math.sin(now * 0.001 + p.phase) * 0.12;
        const opacity = Math.max(0, Math.min(1, p.baseOpacity + breath));

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = config.colour;
        ctx!.globalAlpha = opacity;
        ctx!.fill();
      }

      ctx!.globalAlpha = 1;

      // Connection lines — cap to 80 particles for perf on lower-end devices
      const maxForConnections = Math.min(particles.length, 80);
      for (let i = 0; i < maxForConnections; i++) {
        for (let j = i + 1; j < maxForConnections; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < config.connectionDistance) {
            const lineOpacity = 1 - dist / config.connectionDistance;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = config.lineColour;
            ctx!.globalAlpha = lineOpacity;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      ctx!.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-20 mix-blend-screen"
      aria-hidden="true"
    />
  );
}
