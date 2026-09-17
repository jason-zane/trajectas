"use client";

import { useState } from "react";
import { startBuild, rankBuild, summariseBuild, createBuild } from "@/app/actions/public-builds";
import { PUBLIC_BUILDS_TIERS, type PublicBuildTier } from "@/lib/public-builds/shared";
import type { Brief } from "@/types/ai";
import type { ArchitectMatchResult } from "@/types/architect";
import { VerifyStep } from "./verify-step";
import { BriefStep } from "./brief-step";
import { readPdHandoff, clearPdHandoff } from "./pd-handoff";
import { WorkingStep, type WorkingStage } from "./working-step";
import { ResultStep } from "./result-step";
import { SentStep } from "./sent-step";

type Step = "verify" | "brief" | "working" | "result" | "sent";

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function RoleBuilder() {
  const [step, setStep] = useState<Step>("verify");
  const [email, setEmail] = useState<string | null>(null);
  const [pdHandoff] = useState<string | null>(() => readPdHandoff());
  const [briefError, setBriefError] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [tier, setTier] = useState<PublicBuildTier>("core");
  const [workingStage, setWorkingStage] = useState<WorkingStage>("reading");
  const [ranking, setRanking] = useState<ArchitectMatchResult | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(true);

  async function handleBriefSubmit(input: { roleTitle: string; pdText: string; tier: PublicBuildTier }) {
    clearPdHandoff();
    setBriefError(null);
    setTier(input.tier);
    setStep("working");
    setWorkingStage("reading");
    setBrief(null);
    setRanking(null);
    setRevealedCount(0);
    setSummary(null);

    const started = await startBuild(input);
    if ("error" in started) {
      setBriefError(started.error);
      setStep("brief");
      return;
    }
    setBrief(started.brief);
    setBuildId(started.buildId);
    setWorkingStage("weighing");

    const ranked = await rankBuild(started.buildId);
    if ("error" in ranked) {
      setBriefError(ranked.error);
      setStep("brief");
      return;
    }
    setRanking(ranked);
    setWorkingStage("pinning");

    const target = Math.min(PUBLIC_BUILDS_TIERS[input.tier].capabilities, ranked.picks.length);
    const reduced = prefersReducedMotion();
    if (reduced) {
      setRevealedCount(target);
    } else {
      for (let i = 1; i <= target; i++) {
        await sleep(220);
        setRevealedCount(i);
      }
    }
    await sleep(reduced ? 0 : 350);

    setSelectedIds(ranked.picks.slice(0, target).map((p) => p.factorId));
    setStep("result");

    const included = ranked.picks.slice(0, target).map((p) => ({
      factorName: p.factorName,
      categoryName: p.categoryName,
      rank: p.rank,
    }));
    const excluded = ranked.picks.slice(target).map((p) => ({
      factorName: p.factorName,
      categoryName: p.categoryName,
      rank: p.rank,
    }));
    summariseBuild({ buildId: started.buildId, included, excluded }).then((result) => {
      if (!("error" in result)) setSummary(result.summary);
    });
  }

  function handleSetCount(count: number) {
    if (!ranking) return;
    setSelectedIds(ranking.picks.slice(0, count).map((p) => p.factorId));
  }

  function handleToggle(factorId: string) {
    setSelectedIds((prev) =>
      prev.includes(factorId) ? prev.filter((id) => id !== factorId) : [...prev, factorId],
    );
  }

  async function handleCreate() {
    if (!buildId) return;
    setCreating(true);
    setCreateError(null);
    const result = await createBuild(buildId, selectedIds);
    setCreating(false);
    if ("error" in result) {
      setCreateError(result.error);
      return;
    }
    setSentToken(result.token);
    setEmailSent(result.emailSent);
    setStep("sent");
  }

  function handleBuildAnother() {
    setBrief(null);
    setBuildId(null);
    setRanking(null);
    setRevealedCount(0);
    setSummary(null);
    setSelectedIds([]);
    setSentToken(null);
    setEmailSent(true);
    setCreateError(null);
    setBriefError(null);
    setStep("brief");
  }

  if (step === "verify" || !email) {
    return <VerifyStep onVerified={(e) => { setEmail(e); setStep("brief"); }} />;
  }
  if (step === "brief") {
    return (
      <BriefStep email={email} onSubmit={handleBriefSubmit} error={briefError} initialPdText={pdHandoff ?? undefined} />
    );
  }
  if (step === "working") {
    return (
      <WorkingStep
        email={email}
        brief={brief}
        stage={workingStage}
        consideredCount={ranking?.consideredCount ?? null}
        revealed={ranking?.picks.slice(0, revealedCount) ?? []}
        target={Math.min(PUBLIC_BUILDS_TIERS[tier].capabilities, ranking?.picks.length ?? PUBLIC_BUILDS_TIERS[tier].capabilities)}
      />
    );
  }
  if (step === "result" && ranking && brief) {
    return (
      <ResultStep
        email={email}
        brief={brief}
        ranking={ranking}
        summary={summary}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onSetCount={handleSetCount}
        onCreate={handleCreate}
        creating={creating}
        createError={createError}
      />
    );
  }
  if (step === "sent" && sentToken) {
    return (
      <SentStep
        email={email}
        roleTitle={brief?.roleTitle || "Your role"}
        capabilityCount={selectedIds.length}
        token={sentToken}
        emailSent={emailSent}
        onBuildAnother={handleBuildAnother}
      />
    );
  }

  return <VerifyStep onVerified={(e) => { setEmail(e); setStep("brief"); }} />;
}
