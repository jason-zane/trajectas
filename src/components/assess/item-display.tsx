"use client";

import dynamic from "next/dynamic";
import { LikertResponse } from "./formats/likert-response";
import { ForcedChoiceResponse } from "./formats/forced-choice-response";
import { BinaryResponse } from "./formats/binary-response";
import { FreeTextResponse } from "./formats/free-text-response";
import { SJTResponse } from "./formats/sjt-response";

const RankingResponse = dynamic(
  () =>
    import("./formats/ranking-response").then((m) => m.RankingResponse),
  { loading: () => <RankingLoadingPlaceholder /> },
);

function RankingLoadingPlaceholder() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-xl"
          style={{
            background: "var(--brand-neutral-100, hsl(var(--muted)))",
          }}
        />
      ))}
    </div>
  );
}
import type { ItemForRunner } from "@/app/actions/assess";

interface ItemDisplayProps {
  item: ItemForRunner;
  responseFormatType: string;
  selectedValue?: number;
  responseData?: Record<string, unknown>;
  onResponse: (value: number, data?: Record<string, unknown>) => void;
}

/**
 * Legacy item display for use in the review screen.
 * The main runner uses ItemCard instead.
 */
export function ItemDisplay({
  item,
  responseFormatType,
  selectedValue,
  responseData,
  onResponse,
}: ItemDisplayProps) {
  function handleSelect(value: number, data?: Record<string, unknown>) {
    onResponse(value, data);
  }

  return (
    <div className="space-y-4">
      <p
        className="text-base leading-relaxed"
        style={{ color: "var(--brand-text, hsl(var(--foreground)))" }}
      >
        {item.stem}
      </p>

      <div>
        {responseFormatType === "likert" && (
          <LikertResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={handleSelect}
          />
        )}
        {responseFormatType === "forced_choice" && (
          <ForcedChoiceResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={handleSelect}
            responseData={responseData}
          />
        )}
        {responseFormatType === "binary" && (
          <BinaryResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={handleSelect}
          />
        )}
        {responseFormatType === "ranking" && (
          <RankingResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={handleSelect}
            responseData={responseData}
          />
        )}
        {responseFormatType === "free_text" && (
          <FreeTextResponse
            selectedValue={selectedValue}
            onSelect={handleSelect}
            responseData={responseData}
          />
        )}
        {responseFormatType === "sjt" && (
          <SJTResponse
            options={item.options}
            selectedValue={selectedValue}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
}
