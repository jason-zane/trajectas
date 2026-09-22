"use client";

import { useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const examples = [
  { label: "Selection", context: "A new team leader", situation: "Leading delivery while bringing a team together.", capabilities: ["Judgement", "Collaboration", "People Development"], question: "Where does the evidence support the role — and what should we explore further?", outcome: "A more focused selection conversation" },
  { label: "Development", context: "A manager taking on more", situation: "Moving from personal delivery to developing others.", capabilities: ["People Development", "Self-Insight", "Organisation"], question: "Which strengths can help with the transition, and where would support make a difference?", outcome: "A clearer development focus" },
  { label: "Growth over time", context: "A development programme", situation: "Returning to the capabilities the programme set out to develop.", capabilities: ["Learning Agility", "People Development", "Self-Insight"], question: "What has changed, what have we observed at work, and what should happen next?", outcome: "A more informed progress conversation" },
];

export function PlatformExample() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  return <div className="ph-example" aria-label="Examples of capability assessment in practice">
    <div className="ph-example-top"><span>Capability in context</span><span>Illustrative examples</span></div>
    <div className="ph-example-tabs" role="group" aria-label="Choose a people decision">{examples.map((item, index) => <button key={item.label} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.label}</button>)}</div>
    <div className="ph-example-content" aria-live="polite" aria-atomic="true">
      <div className="ph-example-context"><span className="ph-example-label">The working context</span><h2>{example.context}</h2><p>{example.situation}</p></div>
      <div className="ph-example-capabilities"><span className="ph-example-label">Capabilities to explore</span><ul>{example.capabilities.map(name => <li key={name}>{name}</li>)}</ul></div>
      <div className="ph-example-question"><ArrowDown size={20} aria-hidden /><p>{example.question}</p></div>
      <div className="ph-example-outcome"><span className="ph-example-label">The conversation it supports</span><p>{example.outcome}</p></div>
    </div>
    <Link className="ph-example-more" href="/how-it-works">Context, assessment and human judgement <ArrowUpRight size={16} aria-hidden /></Link>
  </div>;
}
