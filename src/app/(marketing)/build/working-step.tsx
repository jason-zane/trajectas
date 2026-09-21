"use client";

import { useEffect, useState } from "react";
import { Check, FileText, ListChecks, LoaderCircle } from "lucide-react";
import type { Brief } from "@/types/ai";
import { BuilderHeading } from "./builder-frame";

export type WorkingStage = "reading" | "matching" | "creating";

export function WorkingStep({ roleTitle, brief, stage }: { roleTitle: string; brief: Brief | null; stage: WorkingStage }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, []);
  const creating = stage === "creating";
  const active = stage === "reading" ? 0 : stage === "matching" ? 1 : 2;
  const stages = [
    ["Read the role", "Identify the responsibilities, level and working context."],
    ["Match relevant capabilities", "Compare the role with the eligible assessment library."],
    ["Create your assessment", "Prepare the questions, your personal link and invitation email."],
  ];
  return <div className="px-enter"><BuilderHeading title={creating ? "Preparing your assessment." : "Finding what matters for this role."}>{creating ? "Your selection is confirmed. We’re creating the assessment so you can take it next." : "We’re working from your position description. You’ll be able to review and adjust the recommendations."}</BuilderHeading>
    <div className="rb-status-grid"><div><ol className="rb-stages" aria-label="Build progress">{stages.slice(0, creating ? 3 : 2).map(([title, description], index) => <li key={title} data-state={index < active ? "done" : index === active ? "active" : "pending"}><span className="rb-stage-icon">{index < active ? <Check size={22} aria-hidden /> : index === active ? <LoaderCircle className="rb-spinner" size={24} aria-hidden /> : index === 0 ? <FileText size={23} aria-hidden /> : <ListChecks size={23} aria-hidden />}</span><div><h2>{title}</h2><p>{description}</p>{index === active && <div className="rb-live-line" aria-hidden />}</div></li>)}</ol>
      <p role="status" className="rb-help" style={{ marginTop: 20 }}>{stages[active][0]}{stage === "matching" && brief ? ` — role read as ${brief.roleTitle}.` : "…"}</p>
      <p className="rb-elapsed">{seconds}s elapsed{seconds < 30 ? " · This can take a little time." : " · Still working. You don’t need to submit again."}</p>
      {seconds >= 90 && <p className="rb-note" style={{ marginTop: 16 }}>This is taking longer than usual. Keep this page open while the request finishes. If you lose your connection, return here to check your progress.</p>}
    </div><aside className="rb-readout" aria-label="Role details"><span className="px-label">Your role</span><h2>{brief?.roleTitle || roleTitle}</h2>{brief ? <div className="px-enter"><p className="rb-help">{[brief.function, brief.level.replaceAll("_", " ")].filter(Boolean).join(" · ")}</p><ul>{brief.responsibilities.slice(0, 4).map((item, index) => <li key={index}>{item}</li>)}</ul></div> : <p>The responsibilities we identify will appear here once the description has been read.</p>}</aside></div>
  </div>;
}
