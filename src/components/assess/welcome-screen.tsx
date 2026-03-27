"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeScreenProps {
  token: string;
  campaignTitle: string;
  campaignDescription?: string;
  assessmentCount: number;
  candidateFirstName?: string;
  hasInProgressSession: boolean;
  allowResume: boolean;
}

export function WelcomeScreen({
  token,
  campaignTitle,
  campaignDescription,
  assessmentCount,
  candidateFirstName,
  hasInProgressSession,
  allowResume,
}: WelcomeScreenProps) {
  const router = useRouter();

  function handleBegin() {
    router.push(`/assess/${token}/section/0`);
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="space-y-2">
        {candidateFirstName && (
          <p className="text-sm text-muted-foreground">
            Welcome, {candidateFirstName}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">
          {campaignTitle}
        </h1>
        {campaignDescription && (
          <p className="text-muted-foreground leading-relaxed">
            {campaignDescription}
          </p>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-medium">Before you begin</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
            This campaign contains {assessmentCount}{" "}
            {assessmentCount === 1 ? "assessment" : "assessments"}.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
            Your responses are saved automatically as you go.
          </li>
          {allowResume && (
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
              You can leave and return to continue where you left off.
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
            There are no right or wrong answers — respond honestly.
          </li>
        </ul>
      </div>

      {/* CTA */}
      <Button size="lg" onClick={handleBegin} className="w-full sm:w-auto">
        {hasInProgressSession ? (
          <>
            <RotateCcw className="size-4" />
            Resume Assessment
          </>
        ) : (
          <>
            <ArrowRight className="size-4" />
            Begin Assessment
          </>
        )}
      </Button>
    </div>
  );
}
