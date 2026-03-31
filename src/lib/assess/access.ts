export interface CampaignAccessState {
  status: string;
  opensAt?: string | null;
  closesAt?: string | null;
  deletedAt?: string | null;
}

export function getCampaignAccessError(
  campaign: CampaignAccessState,
  now: Date = new Date()
): string | null {
  if (campaign.deletedAt) {
    return "Campaign not found or unavailable.";
  }

  if (!["active", "paused"].includes(campaign.status)) {
    return "This campaign is not currently accepting responses.";
  }

  if (campaign.opensAt && new Date(campaign.opensAt) > now) {
    return "This campaign has not opened yet.";
  }

  if (campaign.closesAt && new Date(campaign.closesAt) < now) {
    return "This campaign has closed.";
  }

  return null;
}

export function getParticipantAccessError(
  participantStatus: string
): string | null {
  if (["withdrawn", "expired"].includes(participantStatus)) {
    return "Your access to this campaign has been revoked.";
  }

  return null;
}
