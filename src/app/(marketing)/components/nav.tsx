"use client";

import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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
      <span
        className="text-lg font-bold tracking-tight"
        style={{ color: "var(--mk-text-on-dark)" }}
      >
        Trajectas
      </span>

      <a
        href="#contact"
        className="text-sm transition-colors duration-200"
        style={{
          color: btnHovered ? "var(--mk-accent)" : "var(--mk-text-on-dark)",
          border: btnHovered
            ? "1px solid var(--mk-accent)"
            : "1px solid rgba(255, 255, 255, 0.3)",
          padding: "8px 20px",
        }}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
      >
        Get in touch
      </a>
    </nav>
  );
}
