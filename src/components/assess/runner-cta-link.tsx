"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Runner CTA as a link, with the design system's hover fill swap.
 *
 * Exists as a client component so Server Component pages (e.g. the
 * assessment-intro page) can render a CTA without passing event handlers
 * across the RSC boundary.
 */
export function RunnerCtaLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-[10px] px-7 py-3 font-semibold transition-colors"
      style={{
        background: hovered
          ? "var(--runner-cta-fill-hover)"
          : "var(--runner-cta-fill)",
        color: "var(--runner-cta-text)",
        fontSize: "14.5px",
        fontWeight: "600",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  );
}
