"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "./progress-bar";
import { SectionTimer } from "./section-timer";
import { ItemDisplay } from "./item-display";
import {
  saveResponse,
  updateSessionProgress,
} from "@/app/actions/assess";
import type { SectionForRunner } from "@/app/actions/assess";

interface SectionWrapperProps {
  token: string;
  sessionId: string;
  section: SectionForRunner;
  sectionIndex: number;
  totalSections: number;
  existingResponses: Record<
    string,
    { value: number; data: Record<string, unknown> }
  >;
  showProgress: boolean;
  allowResume: boolean;
}

export function SectionWrapper({
  token,
  sessionId,
  section,
  sectionIndex,
  totalSections,
  existingResponses,
  showProgress,
}: SectionWrapperProps) {
  const router = useRouter();
  const items = section.items;
  const itemsPerPage = section.itemsPerPage ?? 1;
  const totalPages = Math.ceil(items.length / itemsPerPage);

  const [pageIndex, setPageIndex] = useState(0);
  const [responses, setResponses] = useState(existingResponses);
  const [showInstructions, setShowInstructions] = useState(
    !!section.instructions,
  );

  const pageItems = items.slice(
    pageIndex * itemsPerPage,
    (pageIndex + 1) * itemsPerPage,
  );

  const currentItemIndex = pageIndex * itemsPerPage;

  async function handleResponse(
    itemId: string,
    value: number,
    data?: Record<string, unknown>,
  ) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { value, data: data ?? {} },
    }));

    // Zone 1: immediate save
    await saveResponse({
      sessionId,
      itemId,
      sectionId: section.id,
      responseValue: value,
      responseData: data,
    });
  }

  function handlePrevPage() {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    }
  }

  async function handleNextPage() {
    if (pageIndex < totalPages - 1) {
      setPageIndex(pageIndex + 1);
      await updateSessionProgress(sessionId, {
        currentSectionId: section.id,
        currentItemIndex: (pageIndex + 1) * itemsPerPage,
      });
    } else {
      // End of section — go to next section or review
      if (sectionIndex < totalSections - 1) {
        await updateSessionProgress(sessionId, {
          currentSectionId: undefined,
          currentItemIndex: 0,
        });
        router.push(`/assess/${token}/section/${sectionIndex + 1}`);
      } else {
        router.push(`/assess/${token}/review`);
      }
    }
  }

  const handleTimerExpiry = useCallback(() => {
    // Auto-advance on timer expiry
    if (sectionIndex < totalSections - 1) {
      router.push(`/assess/${token}/section/${sectionIndex + 1}`);
    } else {
      router.push(`/assess/${token}/review`);
    }
  }, [router, token, sectionIndex, totalSections]);

  // Section instruction screen
  if (showInstructions) {
    return (
      <div className="space-y-6">
        {showProgress && (
          <ProgressBar
            sectionIndex={sectionIndex}
            totalSections={totalSections}
            itemIndex={0}
            totalItems={items.length}
          />
        )}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.instructions && (
            <p className="text-muted-foreground leading-relaxed">
              {section.instructions}
            </p>
          )}
          {section.timeLimitSeconds && (
            <p className="text-sm text-muted-foreground">
              Time limit: {Math.ceil(section.timeLimitSeconds / 60)} minutes
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "question" : "questions"} in
            this section
          </p>
        </div>
        <Button onClick={() => setShowInstructions(false)}>
          <ArrowRight className="size-4" />
          Start Section
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress + timer */}
      <div className="flex items-center justify-between gap-4">
        {showProgress && (
          <div className="flex-1">
            <ProgressBar
              sectionIndex={sectionIndex}
              totalSections={totalSections}
              itemIndex={currentItemIndex}
              totalItems={items.length}
            />
          </div>
        )}
        {section.timeLimitSeconds && (
          <SectionTimer
            initialSeconds={section.timeLimitSeconds}
            onExpiry={handleTimerExpiry}
          />
        )}
      </div>

      {/* Items for current page */}
      <div className="space-y-8">
        {pageItems.map((item, idx) => {
          const globalIdx = pageIndex * itemsPerPage + idx;
          const existing = responses[item.id];
          return (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-card p-6"
            >
              <ItemDisplay
                item={item}
                itemNumber={globalIdx + 1}
                totalItems={items.length}
                responseFormatType={section.responseFormatType}
                selectedValue={existing?.value}
                responseData={existing?.data}
                onResponse={(value, data) =>
                  handleResponse(item.id, value, data)
                }
              />
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {section.allowBackNav && pageIndex > 0 && (
            <Button variant="outline" onClick={handlePrevPage}>
              <ArrowLeft className="size-4" />
              Previous
            </Button>
          )}
        </div>
        <Button onClick={handleNextPage}>
          {pageIndex < totalPages - 1 ? (
            <>
              Next
              <ArrowRight className="size-4" />
            </>
          ) : sectionIndex < totalSections - 1 ? (
            <>
              Next Section
              <ArrowRight className="size-4" />
            </>
          ) : (
            <>
              Review
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
