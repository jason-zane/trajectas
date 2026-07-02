"use client";

import { LikertResponse } from "./formats/likert-response";
import { ForcedChoiceResponse } from "./formats/forced-choice-response";
import { BinaryResponse } from "./formats/binary-response";
import { RankingResponse } from "./formats/ranking-response";
import { FreeTextResponse } from "./formats/free-text-response";
import { SJTResponse } from "./formats/sjt-response";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { ItemForRunner } from "@/app/actions/assess";

interface ItemCardProps {
  item: ItemForRunner;
  responseFormatType: string;
  selectedValue?: number;
  responseData?: Record<string, unknown>;
  onResponse: (value: number, data?: Record<string, unknown>) => void;
  onContinue: () => void;
  showContinue: boolean;
  continueButtonLabel?: string;
  continueButtonDisabled?: boolean;
}

/**
 * Single-item card for the assessment runner.
 * Renders the question stem as a serif display moment + response format.
 * Full-bleed surface; no card container.
 */
export function ItemCard({
  item,
  responseFormatType,
  selectedValue,
  responseData,
  onResponse,
  onContinue,
  showContinue,
  continueButtonLabel,
  continueButtonDisabled,
}: ItemCardProps) {
  if (!item) return null;

  const hasResponse = selectedValue !== undefined;

  return (
    <div>
      {/* Question stem — serif display moment */}
      <p
        className="mb-8 max-w-[620px] text-[33px] font-semibold leading-tight sm:text-[33px] sm:leading-tight"
        style={{
          color: "var(--runner-display)",
          fontFamily: '"Source Serif 4", Georgia, serif',
          letterSpacing: "-0.01em",
        }}
      >
        {item.stem}
      </p>

      {/* Response format */}
      <div>
        {responseFormatType === "likert" && (
          <LikertResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={onResponse}
          />
        )}
        {responseFormatType === "forced_choice" && (
          <ForcedChoiceResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={onResponse}
            responseData={responseData}
          />
        )}
        {responseFormatType === "binary" && (
          <BinaryResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={onResponse}
          />
        )}
        {responseFormatType === "ranking" && (
          <RankingResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={onResponse}
            responseData={responseData}
          />
        )}
        {responseFormatType === "free_text" && (
          <FreeTextResponse
            selectedValue={selectedValue}
            onSelect={onResponse}
            responseData={responseData}
          />
        )}
        {responseFormatType === "sjt" && (
          <SJTResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={onResponse}
          />
        )}
      </div>

      {/* Continue button for multi-step formats */}
      {showContinue && hasResponse && (
        <div className="mt-8 flex justify-start">
          <Button
            onClick={onContinue}
            disabled={continueButtonDisabled}
            className="gap-1.5 rounded-[10px] px-7 py-3 text-[14.5px] font-semibold"
            style={{
              background: "var(--runner-cta-fill)",
              color: "var(--runner-cta-text)",
            }}
          >
            {continueButtonLabel ?? "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
