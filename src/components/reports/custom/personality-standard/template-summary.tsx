import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button-variants'
import { PageHeader } from '@/components/page-header'

export function PersonalityTemplateSummary({ id, name, basePath = '/report-templates' }: { id: string; name: string; basePath?: string }) {
  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader eyebrow="Report templates" title={name} description="Nine pages: personality dimensions, the complete profile, five dimension breakdowns and assessment information.">
      <Link className={buttonVariants()} href={`${basePath}/${id}/preview`}>Preview standard report</Link>
    </PageHeader>
    <Alert variant="info"><AlertTitle>Standard results report</AlertTitle><AlertDescription>
      This layout contains scores, trait definitions and behavioural endpoints. It does not include personalised written interpretation. The preview uses sample data. Keep this template inactive until versioned norms are available.
    </AlertDescription></Alert>
  </div>
}
