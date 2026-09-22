"use client";

import { useEffect, useRef, useState } from "react";
import { startBuild, rankBuild, createBuild } from "@/app/actions/public-builds";
import { getPublicBuildSession } from "@/app/actions/public-builds-session";
import type { Brief } from "@/types/ai";
import type { ArchitectMatchResult } from "@/types/architect";
import { recommendedPublicPickCount, type PublicBuildSession } from "@/lib/public-builds/session";
import { PUBLIC_BUILDS_MAX_PD_CHARS } from "@/lib/public-builds/shared";
import { VerifyStep } from "./verify-step";
import { BriefStep, type RoleDraft } from "./brief-step";
import { WorkingStep, type WorkingStage } from "./working-step";
import { ResultStep } from "./result-step";
import { SentStep } from "./sent-step";
import { BuilderFrame, BuilderHeading, BuildError } from "./builder-frame";

type Step = "verify" | "brief" | "working" | "result" | "sent" | "recover";
function sessionStep(session: PublicBuildSession): Step {
  if (!session.email) return "verify";
  if (!session.build) return "brief";
  if (session.build.token) return "sent";
  if (session.build.status === "creating" || !session.build.ranking || !session.build.brief) return "recover";
  return "result";
}
function initialPicks(build: PublicBuildSession["build"]) {
  return build?.picks ?? build?.ranking?.picks.slice(0, recommendedPublicPickCount(build.ranking.recommendedCount.optimal, build.ranking.picks.length)).map(p => p.factorId) ?? [];
}

export function RoleBuilder({ inviteRequired, initialSession, initialError }: { inviteRequired: boolean; initialSession: PublicBuildSession; initialError?: string }) {
  const [step, setStep] = useState<Step>(initialError ? "recover" : sessionStep(initialSession));
  const [email, setEmail] = useState<string | null>(initialSession.email);
  const [draft, setDraft] = useState<RoleDraft>({ roleTitle: initialSession.build?.roleTitle ?? "", pdText: initialSession.build?.pdText ?? "" });
  const [brief, setBrief] = useState<Brief | null>(initialSession.build?.brief ?? null);
  const [buildId, setBuildId] = useState<string | null>(initialSession.build?.id ?? null);
  const [ranking, setRanking] = useState<ArchitectMatchResult | null>(initialSession.build?.ranking ?? null);
  const [selectedIds, setSelectedIds] = useState(initialPicks(initialSession.build));
  const [workingStage, setWorkingStage] = useState<WorkingStage>("reading");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [token, setToken] = useState<string | null>(initialSession.build?.token ?? null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [resumed, setResumed] = useState(Boolean(initialSession.build?.token));
  const [recovering, setRecovering] = useState(false);
  const busy = useRef(false);
  const previousStep = useRef(step);
  const initialCreating = useRef(initialSession.build?.status === "creating");

  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      document.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [step]);

  // Restore only this verified visitor's tab-local draft; storage is never an authorization source.
  useEffect(() => {
    if (!email) return;
    try {
      const saved = sessionStorage.getItem(`trajectas:role-draft:${email}`);
      if (saved) {
        const value: unknown = JSON.parse(saved);
        if (value && typeof value === "object" && "roleTitle" in value && "pdText" in value && typeof value.roleTitle === "string" && typeof value.pdText === "string") {
          setDraft({ roleTitle: value.roleTitle.slice(0, 300), pdText: value.pdText.slice(0, PUBLIC_BUILDS_MAX_PD_CHARS) });
        }
      }
    } catch { /* The builder also works when browser storage is unavailable. */ }
  }, [email]);

  useEffect(() => {
    if (!email || !buildId || !ranking || token) return;
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(`trajectas:role-picks:${email}:${buildId}`) ?? "null");
      if (Array.isArray(saved) && saved.length <= 8 && saved.every(id => typeof id === "string" && ranking.picks.some(pick => pick.factorId === id))) {
        setSelectedIds([...new Set(saved)]);
      }
    } catch { /* Ignore stale or unavailable browser storage. */ }
  }, [email, buildId, ranking, token]);

  function choose(ids: string[]) {
    setSelectedIds(ids);
    try { if (email && buildId) sessionStorage.setItem(`trajectas:role-picks:${email}:${buildId}`, JSON.stringify(ids)); } catch { /* Storage is optional. */ }
  }

  function updateDraft(value: RoleDraft) {
    setDraft(value);
    try { if (email) sessionStorage.setItem(`trajectas:role-draft:${email}`, JSON.stringify(value)); } catch { /* No persistence in restricted browsers. */ }
  }

  function applySession(session: PublicBuildSession) {
    let recoveredDraft = { roleTitle: session.build?.roleTitle ?? "", pdText: session.build?.pdText ?? "" };
    try {
      const saved = session.email && sessionStorage.getItem(`trajectas:role-draft:${session.email}`);
      const value = saved ? JSON.parse(saved) : null;
      if (typeof value?.roleTitle === "string" && typeof value?.pdText === "string") {
        recoveredDraft = { roleTitle: value.roleTitle.slice(0, 300), pdText: value.pdText.slice(0, PUBLIC_BUILDS_MAX_PD_CHARS) };
      }
    } catch { /* The saved server draft remains available without browser storage. */ }
    setDraft(recoveredDraft);
    setEmail(session.email); setBuildId(session.build?.id ?? null); setBrief(session.build?.brief ?? null);
    setRanking(session.build?.ranking ?? null); setSelectedIds(initialPicks(session.build));
    setToken(session.build?.token ?? null); setResumed(Boolean(session.build?.token)); setEmailSent(null);
    initialCreating.current = session.build?.status === "creating";
    setStep(sessionStep(session));
  }

  async function recover() {
    setRecovering(true); setError(null);
    try {
      const session = await getPublicBuildSession();
      if ("error" in session) { setError(session.error); return; }
      applySession(session);
    } catch { setError("We couldn’t check your progress. Check your connection and try again."); }
    finally { setRecovering(false); }
  }

  async function verified(verifiedEmail: string) {
    setEmail(verifiedEmail);
    setRecovering(true);
    try {
      const session = await getPublicBuildSession();
      if ("error" in session) { setError(session.error); setStep("recover"); return; }
      applySession(session);
    } catch { setError("Your email is verified, but we couldn’t check your existing progress. Please try again."); setStep("recover"); }
    finally { setRecovering(false); }
  }

  async function match(id: string) {
    setWorkingStage("matching");
    const ranked = await rankBuild(id);
    if ("error" in ranked) throw new Error(ranked.error);
    setRanking(ranked);
    setSelectedIds(ranked.picks.slice(0, recommendedPublicPickCount(ranked.recommendedCount.optimal, ranked.picks.length)).map(p => p.factorId));
    setStep("result");
  }

  async function submitRole() {
    if (busy.current || !draft.roleTitle.trim() || !draft.pdText.trim()) return;
    busy.current = true; setError(null); setBrief(null); setRanking(null); setStep("working"); setWorkingStage("reading");
    try {
      const started = await startBuild({ buildId: buildId ?? undefined, roleTitle: draft.roleTitle.trim(), pdText: draft.pdText.trim(), tier: "core" });
      if ("error" in started) { setError(started.error); setStep(started.error === "Verify your email first." ? "verify" : "brief"); return; }
      setBuildId(started.buildId); setBrief(started.brief);
      await match(started.buildId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t finish matching the role. Check your connection and try again."); setStep(cause instanceof Error && cause.message === "Verify your email first." ? "verify" : "recover"); }
    finally { busy.current = false; }
  }

  async function retryMatch() {
    if (!buildId || busy.current) return;
    busy.current = true; setError(null); setStep("working"); setWorkingStage("matching");
    try { await match(buildId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Matching failed. Please try again."); setStep(cause instanceof Error && cause.message === "Verify your email first." ? "verify" : "recover"); }
    finally { busy.current = false; }
  }

  async function create() {
    if (!buildId || busy.current) return;
    busy.current = true; setError(null); setStep("working"); setWorkingStage("creating");
    try {
      const result = await createBuild(buildId, selectedIds);
      if ("error" in result) { setError(result.error); initialCreating.current = true; setStep(result.error === "Verify your email first." ? "verify" : "recover"); return; }
      setToken(result.token); setEmailSent(result.emailSent); setResumed(false); setStep("sent");
      try { if (email) sessionStorage.removeItem(`trajectas:role-draft:${email}`); } catch { /* Storage is optional. */ }
    } catch { initialCreating.current = true; setError("We lost the connection while creating your assessment. Check its status before trying again."); setStep("recover"); }
    finally { busy.current = false; }
  }

  function buildAnother() {
    setBuildId(null); setBrief(null); setRanking(null); setSelectedIds([]);
    setToken(null); setEmailSent(null); setResumed(false); setError(null);
    initialCreating.current = false;
    updateDraft({ roleTitle: "", pdText: "" });
    setStep("brief");
  }

  const progress = step === "verify" ? 0 : step === "brief" ? 1 : step === "sent" || (step === "working" && workingStage === "creating") ? 3 : 2;
  return <BuilderFrame step={progress}>
    {step === "verify" && <VerifyStep inviteRequired={inviteRequired} onVerified={verified} />}
    {step === "brief" && email && <BriefStep email={email} draft={draft} onChange={updateDraft} onSubmit={submitRole} error={error} />}
    {step === "working" && <WorkingStep roleTitle={draft.roleTitle} brief={brief} stage={workingStage} />}
    {step === "result" && email && brief && ranking && <ResultStep email={email} brief={brief} ranking={ranking} selectedIds={selectedIds} onToggle={id => choose(selectedIds.includes(id) ? selectedIds.filter(item => item !== id) : selectedIds.length < 8 ? [...selectedIds, id] : selectedIds)} onSetCount={count => choose([...selectedIds, ...ranking.picks.map(p => p.factorId).filter(id => !selectedIds.includes(id))].slice(0, count))} onCreate={create} createError={null} onEdit={() => { setError(null); setStep("brief"); }} />}
    {step === "sent" && email && token && <SentStep email={email} roleTitle={brief?.roleTitle || draft.roleTitle || "Your role"} capabilityCount={selectedIds.length} token={token} emailSent={emailSent} resumed={resumed} onBuildAnother={buildAnother} />}
    {step === "recover" && <div className="rb-ready"><BuilderHeading title="Let’s pick up where you left off.">{initialCreating.current ? "Your assessment may still be processing. Check its status to avoid creating it twice." : "We’ll check your saved progress before continuing."}</BuilderHeading>{error && <BuildError>{error}</BuildError>}<div className="px-actions" style={{ marginTop: 24 }}><button type="button" className="px-button" disabled={recovering} onClick={recover}>{recovering ? "Checking progress…" : "Check progress"}</button>{buildId && brief && !initialCreating.current && <button type="button" className="px-text-button" onClick={retryMatch}>Retry matching</button>}{!initialCreating.current && email && <button type="button" className="px-text-button" onClick={() => { setError(null); setStep("brief"); }}>Back to your role</button>}</div><p className="rb-help">If processing remains stuck, <a href="/contact" className="px-link">contact us</a> and we’ll help you continue.</p></div>}
  </BuilderFrame>;
}
