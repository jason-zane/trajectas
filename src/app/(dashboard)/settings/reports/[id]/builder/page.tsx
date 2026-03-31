import { notFound } from 'next/navigation'
import { getReportTemplate } from '@/app/actions/reports'
import { parseBlocks } from '@/lib/reports/registry'
import { BlockBuilderClient } from './block-builder-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BlockBuilderPage({ params }: Props) {
  const { id } = await params
  const template = await getReportTemplate(id)
  if (!template) notFound()

  const blocks = parseBlocks(template.blocks)

  return (
    <BlockBuilderClient
      templateId={template.id}
      templateName={template.name}
      reportType={template.reportType}
      initialBlocks={blocks}
    />
  )
}
