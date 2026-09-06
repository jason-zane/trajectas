import { TrajectasLogo } from "@/components/brand/trajectas-logo";
export default function MarketingLoading() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ backgroundColor: "var(--mk-primary-dark, #1e4a3e)" }}
    >
      <span
        className="text-lg font-bold tracking-tight animate-shimmer"
        style={{ color: "rgba(255, 255, 255, 0.6)" }}
      >
        <TrajectasLogo variant="horizontal" height={28} light />
      </span>
    </div>
  );
}
