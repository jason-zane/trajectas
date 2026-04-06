"use client";

import { PartnerStats } from "./partner-stats";
import { EnterPortalButton } from "@/components/enter-portal-button";

type PartnerOverviewProps = {
  partner: { id: string; name: string; slug: string };
  stats: {
    clientCount: number;
    activeCampaignCount: number;
    partnerMemberCount: number;
    totalAssessmentsAssigned: number;
  };
  children: React.ReactNode; // the edit form
};

export function PartnerOverview({
  partner,
  stats,
  children,
}: PartnerOverviewProps) {
  return (
    <div className="space-y-6">
      <PartnerStats {...stats} />

      <div className="flex justify-start">
        <EnterPortalButton
          tenantType="partner"
          tenantId={partner.id}
          tenantName={partner.name}
        />
      </div>

      {children}
    </div>
  );
}
