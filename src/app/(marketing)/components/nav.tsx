import Link from "next/link";
import { TrajectasLogo } from "@/components/brand/trajectas-logo";

const NAV_LINKS = [
  { href: "#why", label: "Why Trajectas" },
  { href: "#how", label: "How it works" },
  { href: "#try", label: "Try it" },
  { href: "#cases", label: "Use cases" },
  { href: "#compare", label: "Compare" },
];

export function Nav() {
  return (
    <header className="tj-nav" aria-label="Main navigation">
      <Link href="/" className="tj-nav-brand" aria-label="Trajectas — home">
        <TrajectasLogo variant="horizontal" height={28} />
      </Link>
      <nav className="tj-nav-links">
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
      <div className="tj-nav-ctas">
        <Link href="/login" className="tj-nav-signin">
          Sign in
        </Link>
        <a
          href="#contact"
          className="tj-btn tj-btn-primary"
          style={{ padding: "10px 18px", fontSize: 13 }}
        >
          Book a call →
        </a>
      </div>
    </header>
  );
}
