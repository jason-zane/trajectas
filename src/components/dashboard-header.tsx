"use client";

import { useEffect, useState, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardHeader() {
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const progress = Math.min(window.scrollY / 100, 1);
    setScrollProgress(progress);
  }, []);

  useEffect(() => {
    let rafId: number;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [handleScroll]);

  const blur = 4 + scrollProgress * 16;
  const bgOpacity = 40 + scrollProgress * 45;
  const borderOpacity = scrollProgress * 50;

  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 transition-[border-color] duration-150"
      style={{
        backdropFilter: `blur(${blur}px) saturate(180%)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
        backgroundColor: `oklch(from var(--background) l c h / ${bgOpacity}%)`,
        borderBottom: `1px solid oklch(from var(--border) l c h / ${borderOpacity}%)`,
      }}
    >
      <SidebarTrigger className="-ml-1" />
      <Breadcrumbs className="flex-1" />
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <div className="size-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10" />
      </div>
    </header>
  );
}
