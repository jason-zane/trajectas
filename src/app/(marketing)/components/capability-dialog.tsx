"use client";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { ArchitectEligibleFactor } from "@/types/architect";
export function CapabilityDialog({ capability, reasoning, related = [], onRelated, onClose, children, showModelLink = true }: { capability: ArchitectEligibleFactor | null; reasoning?: string; related?: ArchitectEligibleFactor[]; onRelated?: (id: string) => void; onClose: () => void; children?: ReactNode; showModelLink?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const isOpen = Boolean(capability);
  function keepFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  useEffect(() => { const dialog = ref.current; if (capability && dialog && !dialog.open) dialog.showModal(); if (!capability && dialog?.open) dialog.close(); }, [capability]);
  useEffect(() => { if (capability) { ref.current?.querySelector(".px-dialog-body")?.scrollTo?.({ top: 0 }); ref.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true }); } }, [capability]);
  useEffect(() => { if (!isOpen) return; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; }; }, [isOpen]);
  return <dialog ref={ref} onKeyDown={keepFocus} className="px-capability-dialog" aria-labelledby={titleId} onCancel={onClose} onClose={onClose}><div className="px-dialog-header"><div><span className="px-label">{capability?.categoryName || capability?.dimensionName || "Capability"}</span><h2 id={titleId} tabIndex={-1}>{capability?.factorName}</h2></div><button type="button" className="px-text-button" onClick={onClose} aria-label="Close capability details">Close ×</button></div>{capability && <div className="px-dialog-body"><section><h3>What it means</h3><p>{capability.definition || "A definition is not available for this capability yet."}</p></section>{reasoning && <section className="px-dialog-fit"><h3>Why it matters for this role</h3><p>{reasoning}</p></section>}<section><h3>How it shows up at work</h3><p className="rb-help">Behavioural indicators from the library describe different levels of expression. They are not an assessment result.</p><dl className="rb-indicators">{[["Lower expression", capability.indicatorsLow], ["Mid-range expression", capability.indicatorsMid], ["Higher expression", capability.indicatorsHigh]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{!capability.indicatorsLow && !capability.indicatorsMid && !capability.indicatorsHigh && <p>Behavioural indicators are not available in this version of the library.</p>}</section>{related.length > 0 && <section><h3>Explore the same grouping</h3><p className="rb-help">Shared grouping does not mean interchangeable. Compare what each capability describes.</p><div className="px-related-buttons">{related.map(item => <button key={item.factorId} type="button" className="px-text-button" onClick={() => onRelated?.(item.factorId)}>{item.factorName}</button>)}</div></section>}{showModelLink && <Link href="/capability-model" target="_blank" rel="noreferrer" className="px-link">Explore the full capability model (new tab)</Link>}</div>}{children && <div className="px-dialog-footer">{children}</div>}</dialog>;
}
