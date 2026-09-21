"use client";

import { useState } from "react";
import type { Brief } from "@/types/ai";
import type { ArchitectMatchResult, ArchitectPick } from "@/types/architect";
import { CapabilityDialog } from "../components/capability-dialog";
import { ArrowRight } from "lucide-react";
import { estimatePublicBuildMinutes, PUBLIC_BUILDS_ITEMS_PER_FACTOR } from "@/lib/public-builds/shared";
import { recommendedPublicPickCount } from "@/lib/public-builds/session";
import { BuilderHeading, BuildError } from "./builder-frame";

function CapabilityRow({ pick, checked, disabled, onToggle, onExplore }: { pick: ArchitectPick; checked: boolean; disabled: boolean; onToggle: () => void; onExplore: () => void }) {
  return <li className="rb-pick rb-pick-compact" data-selected={checked}><label className="rb-pick-label"><input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} /><span><strong>{pick.factorName}</strong><p>{pick.definition || pick.reasoning}</p></span></label><button type="button" className="px-text-button" onClick={onExplore} aria-label={`Explore ${pick.factorName}`}>Explore</button></li>;
}

export function ResultStep({ email, brief, ranking, selectedIds, onToggle, onSetCount, onCreate, createError, onEdit }: {
  email: string; brief: Brief; ranking: ArchitectMatchResult; selectedIds: string[]; onToggle: (id: string) => void; onSetCount: (count: number) => void; onCreate: () => void; createError: string | null; onEdit: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = ranking.picks.find(pick => pick.factorId === activeId) ?? null;
  const [filter, setFilter] = useState("");
  const selected = new Set(selectedIds);
  const recommended = recommendedPublicPickCount(ranking.recommendedCount.optimal, ranking.picks.length);
  // Stable main list: removing an item never moves its checkbox out from under keyboard focus.
  const mainCount = recommended;
  const renderPick = (pick: ArchitectPick) => <CapabilityRow key={pick.factorId} pick={pick} checked={selected.has(pick.factorId)} disabled={!selected.has(pick.factorId) && selected.size >= 8} onToggle={() => onToggle(pick.factorId)} onExplore={() => setActiveId(pick.factorId)} />;
  const valid = selected.size >= 4 && selected.size <= 8;
  return <div className="px-enter"><BuilderHeading title="A focused assessment for your role.">Check our understanding of the role, explore the capabilities and their behaviours, then choose what to include.</BuilderHeading>
    <div className="rb-mobile-tally"><span aria-live="polite">{selected.size} selected · About {estimatePublicBuildMinutes(selected.size)} min</span><a href="#assessment-summary" className="px-link">Review summary</a></div>
    <div className="rb-review"><div>
      <section className="rb-role-context"><div className="rb-field-top"><h2>{brief.roleTitle || "Your role"}</h2><button className="px-text-button" type="button" onClick={onEdit}>Edit role</button></div><p>{ranking.summary}</p><div className="rb-role-facts"><span>{brief.function || "Function not identified"}</span><span>{brief.level.replaceAll("_", " ")}</span></div><details className="rb-role-interpretation"><summary>Review our interpretation of the role</summary><div className="rb-role-sections"><section><h3>Core responsibilities</h3><ul>{brief.responsibilities.map((item, i) => <li key={i}>{item}</li>)}</ul></section><section><h3>Working context</h3>{brief.contextSignals.length ? <ul>{brief.contextSignals.map(item => <li key={item}>{item}</li>)}</ul> : <p>No additional working context was identified. Add it to the role description if it matters.</p>}</section><section><h3>Technical or domain requirements</h3>{brief.technicalRequirements.length ? <ul>{brief.technicalRequirements.map(item => <li key={item}>{item}</li>)}</ul> : <p>No specific technical requirements were identified.</p>}<p className="rb-help">These provide context for matching. They are not necessarily measured by this capability assessment.</p></section></div></details>{brief.confidence === "low" && <p className="rb-note">The description gave us limited context. Check the responsibilities above, or add more detail before continuing.</p>}</section>
      <fieldset className="rb-tiers"><legend>Assessment length</legend>{[[4, "Focused"], [6, "Core"], [8, "Extended"]].map(([count, label]) => <button key={count} type="button" disabled={Number(count) > ranking.picks.length} aria-pressed={selected.size === count} onClick={() => onSetCount(Number(count))}>{label} · {count}</button>)}</fieldset>
      <p className="rb-help">{recommended >= 4 ? <>We recommend {recommended} capabilities for this role. </> : null}Choose 4–8. Each adds 6 questions. Shortening keeps the first capabilities you selected.</p>
      {selected.size < 4 && <p className="rb-note" role="status" style={{ marginTop: 16 }}>Select {4 - selected.size} more {4 - selected.size === 1 ? "capability" : "capabilities"} to create your assessment.</p>}
      {selected.size > recommended && <p className="rb-note" style={{ marginTop: 16 }}>Your selection includes {selected.size - recommended} more than the recommended count. <a href="#other-capabilities">Review the other capabilities</a> to check the extra coverage.</p>}
      {selected.size === 8 && <p className="rb-help" role="status" style={{ marginTop: 14 }}>To swap a capability, deselect one first.</p>}
      <div className="rb-selection-heading"><h2>Recommended for this role</h2><p>Review these {mainCount} as a set. Explore a capability for its role fit, behavioural indicators and related concepts.</p></div><ul className="rb-pick-list" aria-label="Recommended capabilities">{ranking.picks.slice(0, mainCount).map(renderPick)}</ul>
      {ranking.picks.length > mainCount && <section className="rb-alternatives" id="other-capabilities"><h2>Other capabilities to consider</h2><p>Broaden your assessment or swap a recommendation. These were also ranked for this role; review their reasoning before choosing.</p><div className="rb-field"><label htmlFor="capability-search">Find an alternative</label><input id="capability-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search name or definition" type="search" /></div><ul className="rb-pick-list" aria-label="Alternative capabilities">{ranking.picks.slice(mainCount).filter(pick => selected.has(pick.factorId) || `${pick.factorName} ${pick.definition ?? ""}`.toLowerCase().includes(filter.toLowerCase())).map(renderPick)}</ul>{!ranking.picks.slice(mainCount).some(pick => selected.has(pick.factorId) || `${pick.factorName} ${pick.definition ?? ""}`.toLowerCase().includes(filter.toLowerCase())) && <p role="status">No matching alternatives. Try another word.</p>}<p className="rb-help">Selected alternatives remain visible when you search.</p></section>}

    </div><aside className="rb-summary" id="assessment-summary" tabIndex={-1}><h2>Your assessment</h2><p>Check your selection before creating the assessment.</p><ul className="rb-selected-names">{ranking.picks.filter(pick => selected.has(pick.factorId)).map(pick => <li key={pick.factorId}>{pick.factorName}</li>)}</ul><dl aria-live="polite" aria-atomic="true"><div><dt>Capabilities</dt><dd>{selected.size}</dd></div><div><dt>Questions</dt><dd>{selected.size * PUBLIC_BUILDS_ITEMS_PER_FACTOR}</dd></div><div><dt>Estimated time</dt><dd>About {estimatePublicBuildMinutes(selected.size)} min</dd></div></dl>
      {createError && <BuildError>{createError}</BuildError>}
      <button type="button" className="px-button" disabled={!valid} onClick={onCreate}>Create my assessment <ArrowRight size={17} aria-hidden /></button>
      <p>You’ll be able to take it immediately. We’ll also send your personal link to <strong>{email}</strong>.</p><p>Free · One person · Link valid for 7 days</p>
    </aside></div>
    <CapabilityDialog capability={active} reasoning={active?.reasoning} onClose={() => setActiveId(null)} related={active ? ranking.picks.filter(pick => pick.factorId !== active.factorId && (active.categoryId ? pick.categoryId === active.categoryId : active.dimensionId ? pick.dimensionId === active.dimensionId : false)) : []} onRelated={setActiveId}>{active && <><p className="rb-help">{selected.size} of 8 selected · Each capability adds 6 questions</p><button className="px-button" type="button" disabled={!selected.has(active.factorId) && selected.size >= 8} onClick={() => onToggle(active.factorId)}>{selected.has(active.factorId) ? "Remove from assessment" : "Add to assessment"}</button></>}</CapabilityDialog>
  </div>;
}
