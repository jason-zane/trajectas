import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getCampaigns } from "@/app/actions/campaigns";
import { getAssessmentAssignments } from "@/app/actions/client-entitlements";
import { ClientDashboard } from "./client-dashboard";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default async function ClientDashboardPage() {
  const { clientId } = await resolveClientOrg("/client/dashboard");

  if (!clientId) {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader eyebrow="Dashboard" title="Welcome" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Building2 className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No client set up yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your account has been created but no client has been configured.
              Contact your administrator to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [campaigns, assignments] = await Promise.all([
    getCampaigns({ clientId }),
    getAssessmentAssignments(clientId),
  ]);

  return (
    <ClientDashboard
      campaigns={campaigns}
      assessmentAssignments={assignments}
    />
  );
}
