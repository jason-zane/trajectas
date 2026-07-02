"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface FreeTextResponseProps {
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
  maxLength?: number;
}

/**
 * Free text response format (dark-editorial re-skin).
 *
 * Textarea with character guidance and warning at >90%.
 * Does NOT auto-advance — requires Continue button (handled by parent).
 * Auto-saves on blur + 3s debounce.
 * Input styling: --runner-input-fill / --runner-input-border (focus → --runner-input-border-focus).
 * Character counter in mono --runner-text-meta, switches to var(--brand-warning) >90%.
 * Uses --runner-* custom properties exclusively.
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
  const isWarning = charPct > 90;

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={(e) => {
          (e.target as HTMLTextAreaElement).style.borderColor =
            "var(--runner-input-border)";
          handleBlur();
        }}
        maxLength={maxLength}
        rows={5}
        className="
          flex w-full px-4 py-3 text-sm
          transition-colors placeholder:opacity-50
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--runner-page)]
          resize-none min-h-[120px]
        "
        style={{
          borderRadius: "10px",
          border: "1px solid",
          borderColor: "var(--runner-input-border)",
          backgroundColor: "var(--runner-input-fill)",
          color: "var(--runner-text)",
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        }}
        onFocus={(e) => {
          (e.target as HTMLTextAreaElement).style.borderColor =
            "var(--runner-input-border-focus)";
        }}
        placeholder="Type your response here..."
      />
      <div className="flex items-center justify-between">
        <p
          className="text-xs"
          style={{ color: "var(--runner-text-muted)" }}
        >
          {text.length > 0
            ? "Your response will be saved automatically"
            : "Write as much or as little as you like"}
        </p>
        <span
          className="text-xs font-semibold uppercase tracking-widest tabular-nums"
          style={{
            fontFamily: '"Geist Mono", ui-monospace, monospace',
            color: isWarning ? "var(--brand-warning)" : "var(--runner-text-meta)",
          }}
        >
          {text.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
