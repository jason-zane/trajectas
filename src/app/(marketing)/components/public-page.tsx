import type { ReactNode } from "react";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "./public-header";
import "../public-experience.css";

export function PublicPage({ label, title, intro, children }: { label: string; title: string; intro: string; children: ReactNode }) {
  return <div className="px-surface px-home px-information"><PublicHeader /><main id="main-content"><header className="px-container px-information-heading"><p className="px-kicker">{label}</p><h1>{title}</h1><p className="px-hero-lede">{intro}</p></header>{children}</main><PublicFooter /></div>;
}
export function PublicNext() {
  return <section className="px-container px-close"><div><h2>Start with a role.</h2><p>Experience the assessment yourself, or talk through your organisation’s needs.</p></div><div className="px-actions"><Link className="px-button" href="/role-builder">Explore Role Builder</Link><Link className="px-link" href="/contact">Talk to us</Link></div></section>;
}
