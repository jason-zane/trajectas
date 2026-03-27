"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { submitSession } from "@/app/actions/assess";
import type { SectionForRunner } from "@/app/actions/assess";

interface ReviewScreenProps {
  token: string;
  sessionId: string;
  sections: SectionForRunner[];
  responses: Record<string, { value: number; data: Record<string, unknown> }>;
  totalItems: number;
  answeredCount: number;
}

export function ReviewScreen({
  token,
  sessionId,
  sections,
  responses,
  totalItems,
  answeredCount,
}: ReviewScreenProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const allAnswered = answeredCount >= totalItems;

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitSession(sessionId);

    if (result.error) {
      setSubmitting(false);
      return;
    }

    router.push(`/assess/${token}/complete`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Review Your Responses</h1>
        <p className="text-muted-foreground">
          {answeredCount} of {totalItems} questions answered
        </p>
      </div>

      {/* Per-section status */}
      <div className="space-y-3">
        {sections.map((section, idx) => {
          const sectionItemIds = new Set(section.items.map((i) => i.id));
          const answered = section.items.filter(
            (i) => responses[i.id] !== undefined,
          ).length;
          const complete = answered === section.items.length;

          return (
            <Card key={section.id}>
              <CardContent className="flex items-center gap-3 py-3">
                {complete ? (
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                ) : (
                  <AlertCircle className="size-5 text-amber-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{section.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {answered} / {section.items.length} answered
                  </p>
                </div>
                {!complete && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      router.push(`/assess/${token}/section/${idx}`)
                    }
                  >
                    Complete
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submit */}
      <div className="pt-4">
        {!allAnswered && (
          <p className="text-sm text-amber-500 mb-3">
            You have unanswered questions. You can still submit, but incomplete
            sections may affect your results.
          </p>
        )}
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full sm:w-auto"
        >
          <Send className="size-4" />
          {submitting ? "Submitting..." : "Submit Assessment"}
        </Button>
      </div>
    </div>
  );
}
