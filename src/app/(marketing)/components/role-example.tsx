"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const examples = [
  { role: "Operations Manager", lines: [
    ["Make decisions when priorities compete.", "Judgement", "Weigh information and make considered decisions."],
    ["Coordinate people, resources and deadlines.", "Planning", "Turn priorities into a practical course of action."],
    ["Work across teams to improve delivery.", "Collaboration", "Build relationships and work towards shared goals."],
    ["Explain priorities clearly across the team.", "Communication", "Make expectations and next steps understood."],
    ["Respond when delivery plans change.", "Adaptability", "Adjust your approach as circumstances change."],
    ["Follow through on service commitments.", "Accountability", "Take ownership of decisions and delivery."],
  ] },
  { role: "People & Culture Lead", lines: [
    ["Guide sensitive people decisions.", "Judgement", "Consider the evidence, context and consequences."],
    ["Bring leaders together through change.", "Collaboration", "Work across different perspectives and priorities."],
    ["Translate people strategy into delivery.", "Planning", "Organise the work around clear priorities."],
    ["Explain decisions to employees and leaders.", "Communication", "Share information clearly and listen to concerns."],
    ["Respond to changing workforce needs.", "Adaptability", "Adjust plans when the context changes."],
    ["Learn from employee feedback.", "Learning", "Use reflection and feedback to improve practice."],
  ] },
  { role: "Customer Success Lead", lines: [
    ["Balance customer needs and business priorities.", "Judgement", "Weigh evidence and competing demands."],
    ["Coordinate onboarding and account reviews.", "Planning", "Organise work around milestones and priorities."],
    ["Work with sales, support and product teams.", "Collaboration", "Build shared understanding across teams."],
    ["Explain next steps to customers.", "Communication", "Make complex information clear and useful."],
    ["Respond to changing customer needs.", "Adaptability", "Adjust your approach as circumstances change."],
    ["Own customer commitments through delivery.", "Accountability", "Follow through and take responsibility."],
  ] },
];

export function RoleExample() {
  const [active, setActive] = useState(0);
  const example = examples[active];
  const summaries = ["Keep day-to-day operations running reliably while balancing people, resources and service priorities. The role needs clear decisions, coordinated delivery and the flexibility to respond when plans change.", "Shape and deliver people practices across the organisation. The role combines sensitive decisions, leadership collaboration, clear communication and learning from the workforce as needs evolve.", "Help customers get value from the product through onboarding, ongoing support and account planning. The role balances customer needs with business priorities and coordinates delivery across teams."];
  return <section className="px-example" aria-label="Example of role matching">
    <div className="px-example-top"><span className="px-label">A role in practice</span><span className="px-muted">Illustrative example</span></div>
    <div className="px-example-layout">
      <div className="px-example-work">
        <div className="px-example-heading"><div><span className="px-label">Position description</span><h2>{example.role}</h2></div><div className="px-example-select"><label htmlFor="example-role">Choose an example</label><select id="example-role" value={active} onChange={event => setActive(Number(event.target.value))}>{examples.map((item, index) => <option value={index} key={item.role}>{item.role}</option>)}</select></div></div>
        <div key={active} className="px-example-model px-enter" aria-live="polite"><div className="px-role-overview"><span className="px-label">What the role calls for</span><p>{summaries[active]}</p><span className="px-example-bridge">Considered together, this suggests</span></div><div><h3>Relevant capabilities</h3><ul className="px-capability-set">{example.lines.map(([, capability, description]) => <li key={capability}><Check size={16} aria-hidden /><div><strong>{capability}</strong><p>{description}</p></div></li>)}</ul></div></div>
        <p className="px-example-caption">An illustrative set based on the whole role. Real recommendations consider responsibilities and context together.</p>
      </div>
      <aside className="px-example-summary"><span className="px-label">An assessment built around it</span><p className="px-example-number">6 <span>capabilities</span></p><dl><div><dt>Questions</dt><dd>36</dd></div><div><dt>To complete</dt><dd>About 7 min</dd></div></dl><p>You review the recommendations and choose what to include.</p><a className="px-link" href="/build">Build for your role <ArrowRight size={17} aria-hidden /></a></aside>
    </div>
  </section>;
}
