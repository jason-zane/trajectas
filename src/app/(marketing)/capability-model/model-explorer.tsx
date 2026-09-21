"use client";
import { useState } from "react";
import type { ArchitectEligibleFactor } from "@/types/architect";
import { CapabilityDialog } from "../components/capability-dialog";
export function ModelExplorer({ capabilities }: { capabilities: ArchitectEligibleFactor[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const groupOf = (capability: ArchitectEligibleFactor) => capability.categoryName || capability.dimensionName || "Other capabilities";
  const groups = [...new Set(capabilities.map(groupOf))];
  const visible = capabilities.filter(capability => (!group || groupOf(capability) === group) && `${capability.factorName} ${capability.definition ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const active = capabilities.find(capability => capability.factorId === activeId) ?? null;
  return <><div className="px-model-controls"><div className="rb-field"><label htmlFor="model-search">Find a capability</label><input id="model-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or definition" /></div><div className="rb-field"><label htmlFor="model-group">Explore a grouping</label><select id="model-group" value={group} onChange={event => setGroup(event.target.value)}><option value="">All groupings</option>{groups.map(name => <option key={name}>{name}</option>)}</select></div></div><p className="rb-help" role="status">{visible.length} of {capabilities.length} capabilities</p><div className="px-model-groups">{groups.filter(name => visible.some(capability => groupOf(capability) === name)).map(name => <section key={name}><h2>{name}</h2><ul>{visible.filter(capability => groupOf(capability) === name).map(capability => <li key={capability.factorId}><button type="button" onClick={() => setActiveId(capability.factorId)}><strong>{capability.factorName}</strong><span>{capability.definition || "Explore this capability"}</span><span className="px-link">View capability</span></button></li>)}</ul></section>)}</div>{visible.length === 0 && <p>No capabilities match these filters. Try a different word or grouping.</p>}<CapabilityDialog showModelLink={false} capability={active} onClose={() => setActiveId(null)} onRelated={setActiveId} related={active ? capabilities.filter(capability => capability.factorId !== active.factorId && groupOf(capability) === groupOf(active)) : []} /></>;
}
