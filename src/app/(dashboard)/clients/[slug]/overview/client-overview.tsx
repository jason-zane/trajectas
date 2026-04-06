"use client";

import { ClientStats } from "./client-stats";
import { EnterPortalButton } from "@/components/enter-portal-button";

type ClientOverviewProps = {
  client: { id: string; name: string; slug: string };
  stats: {
    activeCampaignCount: number;
    totalParticipants: number;
    assignedAssessmentCount: number;
    teamMemberCount: number;
  };
  children: React.ReactNode; // the edit form
};

export function ClientOverview({
  client,
  stats,
  children,
}: ClientOverviewProps) {
  return (
    <div className="space-y-6">
      <ClientStats {...stats} />

      <div className="flex justify-start">
        <EnterPortalButton
          tenantType="client"
          tenantId={client.id}
          tenantName={client.name}
        />
      </div>

      {children}
    </div>
  );
}
