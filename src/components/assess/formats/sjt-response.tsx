"use client";

interface SJTResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

export function SJTResponse({
  options,
  selectedValue,
  onSelect,
}: SJTResponseProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-2">
        Rate each response option for its effectiveness.
      </p>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`w-full rounded-xl border-2 px-4 py-4 text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/50 hover:bg-accent"
            }`}
            aria-pressed={isSelected}
          >
            <span
              className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
