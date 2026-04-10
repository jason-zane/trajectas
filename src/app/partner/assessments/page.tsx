import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPartnerAssessmentLibrary } from "@/app/actions/assessments";
import { AssessmentsTable } from "./assessments-table";

export default async function PartnerAssessmentsPage() {
  const assessments = await getPartnerAssessmentLibrary();
  const ownedAssessments = assessments.filter(
    (assessment) => assessment.ownerScope === "partner"
  );
  const platformAssessments = assessments.filter(
    (assessment) => assessment.ownerScope === "platform"
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Assessments"
        title="Assessment library"
        description="Create partner-owned assessments and reuse platform assessments across client campaigns."
      >
        <Link href="/partner/assessments/create" className={buttonVariants()}>
          <Plus className="size-4" />
          Build Assessment
        </Link>
      </PageHeader>

      <Tabs defaultValue={ownedAssessments.length > 0 ? "owned" : "platform"}>
        <TabsList>
          <TabsTrigger value="owned">
            Your assessments ({ownedAssessments.length})
          </TabsTrigger>
          <TabsTrigger value="platform">
            Platform assessments ({platformAssessments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="mt-6">
          <AssessmentsTable assessments={ownedAssessments} />
        </TabsContent>

        <TabsContent value="platform" className="mt-6">
          <AssessmentsTable assessments={platformAssessments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
