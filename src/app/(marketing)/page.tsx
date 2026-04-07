"use client";

import { ParticleMesh } from "./components/particle-mesh";
import { useMousePosition } from "./components/use-mouse-position";

export default function MarketingPage() {
  const mouse = useMousePosition();
  return (
    <main>
      <ParticleMesh activeSection="hero" mousePosition={mouse} />
      <div className="relative z-10 flex h-screen items-center justify-center">
        <h1 className="mk-display font-[family-name:var(--font-display)] text-white">
          Trajectas
        </h1>
      </div>
    </main>
  );
}
