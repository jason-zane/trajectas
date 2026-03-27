"use client";

import { useState } from "react";

interface FreeTextResponseProps {
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
  maxLength?: number;
}

export function FreeTextResponse({
  onSelect,
  responseData,
  maxLength = 2000,
}: FreeTextResponseProps) {
  const [text, setText] = useState<string>(
    (responseData?.text as string) ?? "",
  );

  function handleBlur() {
    // Use text length as the numeric value (presence indicator)
    onSelect(text.length > 0 ? 1 : 0, { text });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        maxLength={maxLength}
        rows={5}
        className="flex w-full rounded-xl border border-input bg-card px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        placeholder="Type your response here..."
      />
      <div className="text-right text-xs text-muted-foreground">
        {text.length} / {maxLength}
      </div>
    </div>
  );
}
