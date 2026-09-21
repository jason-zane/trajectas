import { Check } from "lucide-react";
import { PublicHeader, PublicFooter } from "../components/public-header";

export function BuilderFrame({ step, children }: { step: number; children: React.ReactNode }) {
  return <div className="px-surface px-builder" data-surface="public-experience"><PublicHeader builder /><main id="main-content" className="px-container rb-main">
    <nav aria-label="Assessment builder progress"><ol className="rb-steps">{["Your email", "Your role", "Capabilities", "Assessment"].map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} data-complete={index < step}><span className="rb-step-index">{index < step ? <Check size={13} aria-hidden /> : index + 1}</span><span>{label}</span></li>)}</ol></nav>
    {children}
  </main><PublicFooter /></div>;
}

export function BuilderHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="rb-page-heading"><h1 tabIndex={-1} data-step-heading>{title}</h1>{children && <p>{children}</p>}</div>;
}

export function BuildError({ children }: { children: React.ReactNode }) {
  return <div className="rb-error" role="alert">{children}</div>;
}
