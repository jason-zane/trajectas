"use client";

import { useCallback, useEffect, useRef } from "react";
import { SECTION_CONFIGS, type ParticleConfig } from "./particle-config";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

interface ParticleMeshProps {
  activeSection: string;
  mousePosition: { x: number; y: number };
}

export function ParticleMesh({
  activeSection,
  mousePosition,
}: ParticleMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const configRef = useRef<ParticleConfig>(SECTION_CONFIGS.hero);
  const animFrameRef = useRef<number>(0);
  const mouseRef = useRef(mousePosition);

  // Store mouse in ref to avoid re-render-driven animation restarts
  mouseRef.current = mousePosition;

  // Update config when section changes
  useEffect(() => {
    configRef.current = SECTION_CONFIGS[activeSection] ?? SECTION_CONFIGS.hero;
  }, [activeSection]);

  const initParticles = useCallback((width: number, height: number) => {
    const config = configRef.current;
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
        opacity:
          config.opacityRange[0] +
          Math.random() * (config.opacityRange[1] - config.opacityRange[0]),
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

    function animate() {
      const config = configRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx!.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mouseRef.current; // Read from ref, not prop

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

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = config.colour;
        ctx!.globalAlpha = p.opacity;
        ctx!.fill();
      }

      ctx!.globalAlpha = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
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
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
