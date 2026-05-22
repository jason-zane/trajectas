import type { CampaignAccessLink } from "@/types/database";

export function getCampaignAccessLinkPath(token: string) {
  return `/assess/join/${token}`;
}

export function buildCampaignAccessLinkUrl(token: string, origin?: string) {
  const path = getCampaignAccessLinkPath(token);

  // Callers in the browser pass window.location.origin; server callers
  // should pass an explicit base (see requireAppUrl in @/lib/hosts). If
  // neither is given we return the relative path — callers that paste
  // links into emails MUST resolve a base before doing so.
  if (!origin) {
    return path;
  }

  return `${origin.replace(/\/$/, "")}${path}`;
}

export function getPrimaryActiveAccessLink<T extends Pick<CampaignAccessLink, "isActive" | "created_at">>(
  links: T[],
): T | undefined {
  return [...links]
    .filter((link) => link.isActive)
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    })[0];
}
