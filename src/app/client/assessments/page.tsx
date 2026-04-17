import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { getClientAssessmentLibrary } from "@/app/actions/client-entitlements";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";

import { AssessmentLibraryTable } from "./assessment-library-table";

export default async function ClientAssessmentsPage() {
  const { clientId } = await resolveClientOrg("/client/assessments");
  if (!clientId) {
    redirect("/client/dashboard");
  }

  const assessments = await getClientAssessmentLibrary(clientId);

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Assessments"
        title="Assessment library"
        description={`${assessments.length} assessment${assessments.length === 1 ? "" : "s"} available to launch in your campaigns.`}
      >
        <Link href="/client/campaigns/create">
          <Button>
            <Plus className="size-4" />
            New Campaign
          </Button>
        </Link>
      </PageHeader>

      <AssessmentLibraryTable assessments={assessments} />
    </div>
  );
}
