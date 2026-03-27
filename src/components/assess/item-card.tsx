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
}

/**
 * Single-item card for the assessment runner.
 * Renders the question stem + response format in a centered card.
 * Uses brand tokens for styling.
 */
export function ItemCard({
  item,
  responseFormatType,
  selectedValue,
  responseData,
  onResponse,
  onContinue,
  showContinue,
}: ItemCardProps) {
  if (!item) return null;

  const hasResponse = selectedValue !== undefined;

  return (
    <div
      className="rounded-2xl border p-6 sm:p-8 shadow-sm dark:shadow-none"
      style={{
        background: "var(--brand-neutral-50, hsl(var(--card)))",
        borderColor: "var(--brand-neutral-200, hsl(var(--border)))",
      }}
    >
      {/* Question stem — no question numbers */}
      <p
        className="mb-6 text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
        style={{
          color: "var(--brand-text, hsl(var(--foreground)))",
          fontFamily: "var(--brand-font-heading, inherit)",
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
        <div className="mt-6 flex justify-end">
          <Button
            onClick={onContinue}
            className="gap-1.5"
            style={{
              background: "var(--brand-primary, hsl(var(--primary)))",
              color: "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
            }}
          >
            Continue
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
