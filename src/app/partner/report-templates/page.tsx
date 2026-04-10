import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getReportTemplates } from "@/app/actions/reports";
import { CreateTemplateButton } from "@/app/(dashboard)/report-templates/create-template-button";
import { ReportTemplatesTable } from "@/app/(dashboard)/report-templates/report-templates-table";

export default async function PartnerReportTemplatesPage() {
  const templates = await getReportTemplates();
  const ownedTemplates = templates.filter((template) => Boolean(template.partnerId));
  const platformTemplates = templates.filter((template) => !template.partnerId);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Reports"
        title="Report templates"
        description="Create partner-owned report templates and reuse platform templates across your campaigns."
      >
        <CreateTemplateButton basePath="/partner/report-templates" />
      </PageHeader>

      <Tabs defaultValue={ownedTemplates.length > 0 ? "owned" : "platform"}>
        <TabsList>
          <TabsTrigger value="owned">
            Your templates ({ownedTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="platform">
            Platform templates ({platformTemplates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="mt-6">
          <ReportTemplatesTable
            templates={ownedTemplates}
            basePath="/partner/report-templates"
          />
        </TabsContent>

        <TabsContent value="platform" className="mt-6">
          <ReportTemplatesTable
            templates={platformTemplates}
            basePath="/partner/report-templates"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
