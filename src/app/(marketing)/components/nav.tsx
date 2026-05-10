"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let rafId = 0;

    function handleScroll() {
      const next = window.scrollY > 50;
      if (next !== scrolledRef.current) {
        scrolledRef.current = next;
        setScrolled(next);
      }
    }

    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    }

    handleScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-4 md:px-8 md:py-5 transition-all duration-200"
      style={{
        backgroundColor: scrolled ? "rgba(30, 74, 62, 0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px) saturate(180%)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(255, 255, 255, 0.06)"
          : "1px solid transparent",
      }}
    >
      <Link
        href="/"
        className="text-lg font-bold tracking-tight"
        style={{ color: "var(--mk-text-on-dark)" }}
      >
        Trajectas
      </Link>

      <div className="flex items-center gap-2 md:gap-3">
        <Link
          href="/login"
          className="rounded-full border border-white/30 px-4 py-2 text-sm text-[var(--mk-text-on-dark)] transition-colors duration-200 hover:border-[var(--mk-accent)] hover:text-[var(--mk-accent)]"
        >
          Log in
        </Link>
        <a
          href="#contact"
          className="rounded-full border border-[var(--mk-accent)] bg-[var(--mk-accent)] px-4 py-2 text-sm text-[var(--mk-primary-dark)] transition-colors duration-200 hover:bg-[#d4b570] hover:border-[#d4b570]"
        >
          Get in touch
        </a>
      </div>
    </nav>
  );
}
