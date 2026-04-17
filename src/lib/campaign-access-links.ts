import type { CampaignAccessLink } from "@/types/database";

export function getCampaignAccessLinkPath(token: string) {
  return `/assess/join/${token}`;
}

export function buildCampaignAccessLinkUrl(token: string, origin?: string) {
  const path = getCampaignAccessLinkPath(token);
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!base) {
    return path;
  }

  return `${base.replace(/\/$/, "")}${path}`;
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
