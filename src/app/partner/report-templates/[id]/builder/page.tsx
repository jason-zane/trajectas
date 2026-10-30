import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { notFound } from "next/navigation";
import {
  getAllCampaigns,
  getReportPrompts,
  getReportTemplate,
  getTemplateUsage,
} from "@/app/actions/reports";
import { parseBlocks } from "@/lib/reports/registry";
import { BlockBuilderClient } from "@/app/(dashboard)/report-templates/[id]/builder/block-builder-client";
import type { TemplateSettings } from "@/app/(dashboard)/report-templates/[id]/builder/block-builder-client";
import { PersonalityTemplateSummary } from '@/components/reports/custom/personality-standard/template-summary'
import { PERSONALITY_REPORT_SLUG } from '@/lib/reports/custom/personality-standard/data'

export default async function PartnerReportTemplateBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('reportTemplateAuthoring')) return <WorkspaceFeatureUnavailable feature="reportTemplateAuthoring" />

  const { id } = await params;
  const [template, usage, campaigns, promptOptions] = await Promise.all([
    getReportTemplate(id),
    getTemplateUsage(id),
    getAllCampaigns(),
    getReportPrompts(),
  ]);

  if (!template) notFound();
  if (template.customReportSlug === PERSONALITY_REPORT_SLUG) {
    return <PersonalityTemplateSummary id={template.id} name={template.name} basePath="/partner/report-templates" />
  }

  const templateSettings: TemplateSettings = {
    description: template.description,
    displayLevel: template.displayLevel,
    groupByDimension: template.groupByDimension,
    personReference: template.personReference,
    pageHeaderLogo: template.pageHeaderLogo,
  };

  return (
    <BlockBuilderClient
      templateId={template.id}
      templateName={template.name}
      reportType={template.reportType}
      initialBlocks={parseBlocks(template.blocks)}
      initialUsage={usage}
      campaigns={campaigns}
      templateSettings={templateSettings}
      promptOptions={promptOptions}
      basePath="/partner/report-templates"
    />
  );
}
