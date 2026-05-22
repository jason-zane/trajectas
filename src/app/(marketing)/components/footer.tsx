import { TrajectasLogo } from "@/components/brand/trajectas-logo";

const PRODUCT = [
  { label: "Why Trajectas", href: "#why" },
  { label: "How it works", href: "#how" },
  { label: "Try a sample", href: "#try" },
  { label: "Use cases", href: "#cases" },
  { label: "Compare", href: "#compare" },
];

const TALK = [
  { label: "Book a discovery call", href: "#contact" },
  { label: "hello@trajectas.com", href: "mailto:hello@trajectas.com" },
];

export function Footer() {
  return (
    <footer className="tj-footer">
      <div className="tj-footer-cols">
        <div className="tj-footer-brand">
          <TrajectasLogo variant="horizontal" light height={28} />
          <p>
            Trajectas builds psychometric instruments around your organisation.
            Capabilities, contextualised.
          </p>
        </div>
        <FooterCol title="Product" items={PRODUCT} />
        <FooterCol title="Talk" items={TALK} />
      </div>
      <div className="tj-footer-bottom">
        <span>© 2026 Trajectas</span>
        <span className="tj-mono">Capabilities, contextualised.</span>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="tj-footer-h">{title}</p>
      <ul>
        {items.map((it) => (
          <li key={it.label}>
            <a href={it.href}>{it.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
