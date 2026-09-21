import Link from "next/link";
import { TrajectasLogo } from "@/components/brand/trajectas-logo";

export function PublicHeader({ builder = false }: { builder?: boolean }) {
  return <header className="px-header">
    <a href="#main-content" className="px-skip">Skip to content</a>
    <div className="px-container px-header-inner">
      <Link href="/" aria-label="Trajectas home"><TrajectasLogo variant="horizontal" height={30} /></Link>
      {builder ? <><span className="px-header-product">Role Builder</span><Link className="px-header-end" href="/">Back to home</Link></> :
        <nav aria-label="Main navigation"><a className="px-nav-section" href="/how-it-works">How it works</a><a className="px-nav-section" href="/for-teams">For teams</a><Link href="/capability-model">The model</Link><Link href="/contact">Contact</Link><Link href="/login" className="px-signin">Sign in</Link></nav>}
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="px-footer px-container"><span>© {new Date().getFullYear()} Trajectas</span><span>Capabilities, contextualised.</span><nav aria-label="Footer navigation"><Link href="/how-it-works">How it works</Link><Link href="/for-teams">For teams</Link><Link href="/capability-model">The model</Link><Link href="/contact">Contact</Link></nav></footer>;
}
