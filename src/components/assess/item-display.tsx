"use client";

import { LikertResponse } from "./formats/likert-response";
import { ForcedChoiceResponse } from "./formats/forced-choice-response";
import { BinaryResponse } from "./formats/binary-response";
import { RankingResponse } from "./formats/ranking-response";
import { FreeTextResponse } from "./formats/free-text-response";
import { SJTResponse } from "./formats/sjt-response";
import type { ItemForRunner } from "@/app/actions/assess";

interface ItemDisplayProps {
  item: ItemForRunner;
  itemNumber: number;
  totalItems: number;
  responseFormatType: string;
  selectedValue?: number;
  responseData?: Record<string, unknown>;
  onResponse: (value: number, data?: Record<string, unknown>) => void;
}

export function ItemDisplay({
  item,
  itemNumber,
  totalItems,
  responseFormatType,
  selectedValue,
  responseData,
  onResponse,
}: ItemDisplayProps) {
  function handleSelect(value: number, data?: Record<string, unknown>) {
    onResponse(value, data);
  }

  return (
    <div className="space-y-6">
      {/* Item stem */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Question {itemNumber} of {totalItems}
        </p>
        <p className="text-lg leading-relaxed">{item.stem}</p>
      </div>

      {/* Response format */}
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
