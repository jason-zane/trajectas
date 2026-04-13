import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAssessments } from "@/app/actions/assessments";
import { getItemSelectionRules } from "@/app/actions/item-selection-rules";
import { RulesEditor } from "./rules-editor";
import { AssessmentsDataTable } from "./assessments-data-table";

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [assessments, rules, { tab }] = await Promise.all([
    getAssessments(),
    getItemSelectionRules(),
    searchParams,
  ]);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Assessments"
        title="Assessments"
        description="Build and manage psychometric assessments from your factor library."
      >
        <Link href="/assessments/create">
          <Button>
            <Plus className="size-4" />
            Build Assessment
          </Button>
        </Link>
      </PageHeader>

      <Tabs defaultValue={tab ?? "assessments"}>
        <TabsList>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="rules">Item Selection Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="assessments" className="mt-6">
          <AssessmentsDataTable assessments={assessments} />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RulesEditor initialRules={rules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
