import type { Brief } from "@/types/ai";
import type { ArchitectMatchResult } from "@/types/architect";

/** Only the public builder's own progress is returned, never admin usage/error records. */
export interface PublicBuildSession {
  email: string | null;
  build: {
    id: string;
    roleTitle: string;
    pdText: string;
    brief: Brief | null;
    ranking: ArchitectMatchResult | null;
    picks: string[] | null;
    status: "ranked" | "creating" | "created" | "started";
    token: string | null;
  } | null;
}

export function recommendedPublicPickCount(optimal: number, available: number): number {
  const target = Number.isFinite(optimal) ? Math.round(optimal) : 6;
  return Math.min(available, Math.max(4, Math.min(8, target)));
}
