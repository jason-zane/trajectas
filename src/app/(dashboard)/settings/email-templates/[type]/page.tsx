import { notFound } from "next/navigation"

import { getEmailTemplate } from "@/app/actions/email-templates"
import {
  EMAIL_TYPES,
  EMAIL_TYPE_LABELS,
  type EmailType,
  type EmailTemplateScope,
} from "@/lib/email/types"
import { PageHeader } from "@/components/page-header"
import { EmailTemplateEditor } from "./email-template-editor"

interface Props {
  params: Promise<{ type: string }>
  searchParams: Promise<{ scope?: string; scopeId?: string }>
}

export default async function EmailTemplateEditPage({
  params,
  searchParams,
}: Props) {
  const { type } = await params
  const sp = await searchParams

  if (!EMAIL_TYPES.includes(type as EmailType)) {
    notFound()
  }

  const emailType = type as EmailType
  const scopeType = (sp.scope ?? "platform") as EmailTemplateScope
  const scopeId = sp.scopeId ?? null

  const template = await getEmailTemplate(emailType, scopeType, scopeId)

  return (
    <div className="space-y-8">
      <PageHeader
        title={EMAIL_TYPE_LABELS[emailType]}
        eyebrow="Email Templates"
        description={`Edit the ${EMAIL_TYPE_LABELS[emailType].toLowerCase()} email template.`}
      />

      <EmailTemplateEditor
        type={emailType}
        scopeType={scopeType}
        scopeId={scopeId}
        initialSubject={template?.subject ?? ""}
        initialPreviewText={template?.preview_text ?? ""}
        initialEditorJson={template?.editor_json ?? null}
      />
    </div>
  )
}
