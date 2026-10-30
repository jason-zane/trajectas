'use client'
import { useState, useTransition, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { updatePersonalityReportPresentation } from '@/app/actions/personality-report-presentation'
import { DEFAULT_PERSONALITY_HEADLINE, parsePersonalityPresentation, personalityPresentation, type PersonalityPresentationConfig } from '@/lib/reports/custom/personality-standard/presentation-config'
const subscribe = () => () => {}
const clientReady = () => true
const serverReady = () => false
const fields = [{ key: 'name', label: 'Display name', max: 80 }, { key: 'definition', label: 'Definition', max: 500 },
  { key: 'lowAnchor', label: 'Left endpoint label', max: 80 }, { key: 'highAnchor', label: 'Right endpoint label', max: 80 },
  { key: 'lower', label: 'Left endpoint description', max: 500 }, { key: 'higher', label: 'Right endpoint description', max: 500 }] as const
export function PersonalityPresentationEditor({ id, name, initialConfig, updatedAt }: { id: string; name: string; initialConfig?: unknown; updatedAt: string }) {
  const router = useRouter()
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady)
  const initial = () => ({ ...parsePersonalityPresentation(initialConfig), coverHeadline: parsePersonalityPresentation(initialConfig).coverHeadline ?? DEFAULT_PERSONALITY_HEADLINE })
  const [config, setConfig] = useState<PersonalityPresentationConfig>(initial)
  const [templateName, setName] = useState(name)
  const [saved, setSaved] = useState(() => JSON.stringify({ name, config: initial() }))
  const [revision, setRevision] = useState(updatedAt)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const dirty = JSON.stringify({ name: templateName, config }) !== saved
  const unsaved = useUnsavedChanges(dirty)
  const dimensions = personalityPresentation()
  function field(code: string, key: typeof fields[number]['key'], value: string) {
    setConfig(current => {
      const scale = { ...current.scales[code] }
      if (value.trim()) scale[key] = value
      else delete scale[key]
      return { ...current, scales: { ...current.scales, [code]: scale } }
    })
  }
  return <form className="space-y-6" onSubmit={e => { e.preventDefault(); start(async () => {
    setError(null)
    try {
      const name = templateName.trim()
      if (!name) throw new Error('Enter a template name before saving.')
      if (!config.coverHeadline?.trim()) throw new Error('Enter a cover headline before saving.')
      const presentation: PersonalityPresentationConfig = parsePersonalityPresentation(config)
      const result = await updatePersonalityReportPresentation({ id, name, presentation, expectedUpdatedAt: revision })
      setName(name); setRevision(result.updatedAt); setConfig(presentation); setSaved(JSON.stringify({ name, config: presentation })); toast.success('Report presentation saved'); router.refresh()
    } catch (e) { const message = e instanceof Error ? e.message : 'Unable to save presentation'; setError(message); toast.error(message) }
  }) }}>
    <div className="space-y-2"><label className="text-sm font-medium" htmlFor="personality-template-name">Template name</label><Input disabled={!hydrated || pending} id="personality-template-name" value={templateName} maxLength={160} required onChange={e => setName(e.target.value)} /></div>
    <div className="space-y-2"><label className="text-sm font-medium" htmlFor="personality-cover-headline">Cover headline</label><Textarea disabled={!hydrated || pending} id="personality-cover-headline" value={config.coverHeadline ?? DEFAULT_PERSONALITY_HEADLINE} maxLength={100} onChange={e => { const value = e.currentTarget.value; setConfig(c => ({ ...c, coverHeadline: value })) }} /></div>
    <p className="text-sm text-muted-foreground">These are report presentation edits. The original statements, score direction and saved results stay fixed. New editions use the saved wording; existing reports keep their original content.</p>
    {dimensions.map(d => <details key={d.code} className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer font-semibold">{d.name}</summary><div className="mt-5 space-y-6">{[d, ...d.facets].map(s => <fieldset key={s.code} className="space-y-3"><legend className="text-sm font-semibold">{s.name} <span className="font-mono text-caption text-muted-foreground">{s.code}</span></legend>
        {fields.map(f => <div className="space-y-1" key={f.key}><label className="text-sm" htmlFor={`presentation-${s.code}-${f.key}`}>{f.label}</label>
          <Textarea disabled={!hydrated || pending} id={`presentation-${s.code}-${f.key}`} aria-label={`${s.code} ${f.label}`} value={config.scales[s.code]?.[f.key] ?? ''} placeholder={s[f.key]} maxLength={f.max} rows={f.key === 'name' || f.key.endsWith('Anchor') ? 1 : 2} onChange={e => field(s.code, f.key, e.target.value)} />
        </div>)}</fieldset>)}</div>
    </details>)}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Button type="submit" disabled={!hydrated || !dirty || pending}>{pending ? 'Saving…' : 'Save presentation'}</Button>
    <ConfirmDialog open={unsaved.showDialog} onOpenChange={open => { if (!open) unsaved.cancelNavigation() }} title="Discard unsaved presentation?" description="Your report wording has not been saved." confirmLabel="Discard changes" onConfirm={unsaved.confirmNavigation} />
  </form>
}
