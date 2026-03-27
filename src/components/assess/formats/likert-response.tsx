"use client";

interface LikertResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

export function LikertResponse({
  options,
  selectedValue,
  onSelect,
}: LikertResponseProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent"
            }`}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
