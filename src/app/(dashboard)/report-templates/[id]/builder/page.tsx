import { notFound } from 'next/navigation'
import { getReportTemplate, getTemplateUsage, getAllCampaigns, getReportPrompts } from '@/app/actions/reports'
import { parseBlocks } from '@/lib/reports/registry'
import { BlockBuilderClient } from './block-builder-client'
import type { TemplateSettings } from './block-builder-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BlockBuilderPage({ params }: Props) {
  const { id } = await params
  const [template, usage, campaigns, promptOptions] = await Promise.all([
    getReportTemplate(id),
    getTemplateUsage(id),
    getAllCampaigns(),
    getReportPrompts(),
  ])
  if (!template) notFound()

  const blocks = parseBlocks(template.blocks)

  const templateSettings: TemplateSettings = {
    description: template.description,
    displayLevel: template.displayLevel,
    groupByDimension: template.groupByDimension,
    personReference: template.personReference,
    pageHeaderLogo: template.pageHeaderLogo,
  }

  return (
    <BlockBuilderClient
      templateId={template.id}
      templateName={template.name}
      reportType={template.reportType}
      initialBlocks={blocks}
      initialUsage={usage}
      campaigns={campaigns}
      templateSettings={templateSettings}
      initialIsDefault={template.isDefault}
      promptOptions={promptOptions}
    />
  )
}
