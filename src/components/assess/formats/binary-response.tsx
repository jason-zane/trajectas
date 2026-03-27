"use client";

interface BinaryResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

export function BinaryResponse({
  options,
  selectedValue,
  onSelect,
}: BinaryResponseProps) {
  // Use first two options, or fallback to Yes/No
  const choices =
    options.length >= 2
      ? options.slice(0, 2)
      : [
          { id: "yes", label: "Yes", value: 1 },
          { id: "no", label: "No", value: 0 },
        ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {choices.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`rounded-xl border-2 px-6 py-6 text-center text-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isSelected
                ? "border-primary bg-primary/10 text-primary shadow-sm"
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
