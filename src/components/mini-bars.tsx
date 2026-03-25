export function MiniBars({ color }: { color: string }) {
  const heights = [40, 70, 55, 85, 45];
  return (
    <svg
      width="32"
      height="16"
      viewBox="0 0 32 16"
      fill="none"
      className="opacity-40"
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 7}
          y={16 - (h / 100) * 16}
          width="4"
          height={(h / 100) * 16}
          rx="1"
          fill={color}
        />
      ))}
    </svg>
  );
}
