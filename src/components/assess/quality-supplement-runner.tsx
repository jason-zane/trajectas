'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { saveQualitySupplementAnswer } from '@/app/actions/response-quality'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ItemCard } from './item-card'
import { ProgressBar } from './progress-bar'
import { QUALITY_ANCHORS, type QualityModuleForRunner } from '@/lib/instrument/ipip-neo-120/response-quality'

export function QualitySupplementRunner({ token, sessionId, module, nextUrl, brandName, brandLogoUrl }: {
  token: string; sessionId: string; module: QualityModuleForRunner; nextUrl: string; brandName?: string; brandLogoUrl?: string
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState(module.answers)
  const [revision, setRevision] = useState(module.revision)
  const [index, setIndex] = useState(() => Math.max(0, module.questions.findIndex(q => module.answers[q.id] == null)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedValue, setFailedValue] = useState<number | null>(null)
  const question = module.questions[index]
  async function save(value: number) {
    if (saving) return
    setSaving(true); setError(null); setFailedValue(null)
    try {
      const result = await saveQualitySupplementAnswer({ token, sessionId, questionId: question.id, value, revision })
      if ('error' in result) { setError(result.error); setFailedValue(value); toast.error(result.error); return }
      setAnswers(result.saved.answers); setRevision(result.saved.revision)
    } catch { setError('Your answer could not be saved. Please retry.'); setFailedValue(value); toast.error('Your answer could not be saved.') }
    finally { setSaving(false) }
  }
  const answered = answers[question.id] != null && !error
  function advance() {
    if (!answered || saving) return
    if (index < module.questions.length - 1) setIndex(index + 1)
    else router.push(nextUrl)
  }
  return <div className="flex min-h-dvh flex-col">
    <ProgressBar currentIndex={120 + Object.keys(answers).length} totalItems={120 + module.questions.length} />
    <header className="px-6 py-6 sm:px-10 lg:px-[120px]"><BrandLogo name={brandName} logoUrl={brandLogoUrl} height={28} runner /></header>
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-10">
      <p className="text-overline text-muted-foreground">Final statements · {index + 1} of {module.questions.length}</p>
      <p className="text-sm text-muted-foreground">Please read each statement and select your response. These supplementary statements help us review response quality and do not contribute to your personality scores.</p>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <fieldset disabled={saving} aria-busy={saving}>
        <legend className="sr-only">{question.stem}</legend>
        <ItemCard item={{ id: question.id, stem: question.stem, displayOrder: index, options: QUALITY_ANCHORS.map((label, i) => ({ id: `${question.id}-${i + 1}`, label, value: i + 1, sortOrder: i })) }}
          responseFormatType="likert" selectedValue={answers[question.id]} onResponse={value => void save(value)} onContinue={advance} showContinue={false} />
      </fieldset>
      <p role="status" className="text-caption text-muted-foreground">{saving ? 'Saving…' : answered ? 'Saved' : 'Choose an answer to continue.'}</p>
      <div className="flex flex-wrap gap-3">
        {index > 0 ? <Button variant="outline" disabled={saving || Boolean(error)} onClick={() => setIndex(index - 1)}>Back</Button> : null}
        {failedValue != null ? <Button disabled={saving} onClick={() => void save(failedValue)}>Retry saving</Button> : null}
        {error ? <Button variant="outline" disabled={saving} onClick={() => window.location.reload()}>Reload saved answers</Button> : null}
        <Button disabled={!answered || saving} onClick={advance}>{index === module.questions.length - 1 ? 'Continue to finish' : 'Continue'}</Button>
      </div>
    </main>
  </div>
}
