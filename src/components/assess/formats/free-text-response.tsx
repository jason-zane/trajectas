"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface FreeTextResponseProps {
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
  maxLength?: number;
}

/**
 * Free text response format.
 *
 * Textarea with character guidance.
 * Does NOT auto-advance — requires Continue button (handled by parent).
 * Auto-saves on blur + 3s debounce.
 * Uses brand tokens for styling.
 */
export function FreeTextResponse({
  onSelect,
  responseData,
  maxLength = 2000,
}: FreeTextResponseProps) {
  const [text, setText] = useState<string>(
    (responseData?.text as string) ?? ""
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Auto-save via debounce
  const save = useCallback(
    (value: string) => {
      onSelect(value.length > 0 ? 1 : 0, { text: value });
    },
    [onSelect]
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);

    // Debounced auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 3000);
  }

  function handleBlur() {
    // Save immediately on blur
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(text);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const charPct = Math.round((text.length / maxLength) * 100);

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={maxLength}
        rows={5}
        className="flex w-full rounded-xl border px-4 py-3 text-sm shadow-sm transition-colors placeholder:opacity-50 focus-visible:outline-none focus-visible:ring-2 resize-none min-h-[120px]"
        style={{
          borderColor: "var(--brand-neutral-200, hsl(var(--border)))",
          background: "transparent",
          color: "var(--brand-text, hsl(var(--foreground)))",
        }}
        placeholder="Type your response here..."
      />
      <div className="flex items-center justify-between">
        <p
          className="text-xs"
          style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
        >
          {text.length > 0
            ? "Your response will be saved automatically"
            : "Write as much or as little as you like"}
        </p>
        <span
          className={`text-xs tabular-nums ${charPct > 90 ? "text-amber-500" : ""}`}
          style={
            charPct <= 90
              ? { color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }
              : undefined
          }
        >
          {text.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
