import { notFound } from 'next/navigation'
import { getReportTemplate, getTemplateUsage, getAllCampaigns } from '@/app/actions/reports'
import { parseBlocks } from '@/lib/reports/registry'
import { BlockBuilderClient } from './block-builder-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BlockBuilderPage({ params }: Props) {
  const { id } = await params
  const [template, usage, campaigns] = await Promise.all([
    getReportTemplate(id),
    getTemplateUsage(id),
    getAllCampaigns(),
  ])
  if (!template) notFound()

  const blocks = parseBlocks(template.blocks)

  return (
    <BlockBuilderClient
      templateId={template.id}
      templateName={template.name}
      reportType={template.reportType}
      initialBlocks={blocks}
      initialUsage={usage}
      campaigns={campaigns}
    />
  )
}
