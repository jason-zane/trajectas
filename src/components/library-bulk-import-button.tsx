'use client'

import { useMemo, useState, useTransition, type ChangeEvent } from 'react'
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Sparkles,
  TriangleAlert,
  Upload,
  WandSparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  importLibraryRows,
  structureLibraryImportWithAI,
  type BulkImportEntity,
  type BulkImportResult,
} from '@/app/actions/bulk-import'

type ImportConfig = {
  title: string
  description: string
  sample: string
  notes: string[]
}

type ImportStep = 'prepare' | 'review'

const IMPORT_CONFIG: Record<BulkImportEntity, ImportConfig> = {
  dimensions: {
    title: 'Bulk Import Dimensions',
    description:
      'Upload a CSV or TSV for top-level dimensions. Slug is optional and will be generated from the name if omitted.',
    sample: [
      'name,slug,description,definition,display_order,is_active,indicators_low,indicators_mid,indicators_high',
      '"Drive & Delivery",drive-delivery,"Execution under pressure","Sustains focus and delivery in demanding contexts",0,true,"Misses deadlines","Delivers consistently","Drives performance under pressure"',
    ].join('\n'),
    notes: [
      'Accepted fields: name, slug, description, definition, display_order, is_active, indicators_low, indicators_mid, indicators_high.',
      'CSV and TSV are both supported.',
    ],
  },
  factors: {
    title: 'Bulk Import Factors',
    description:
      'Upload factor rows and optionally reference an existing dimension, client, or construct linkage by name, slug, or ID.',
    sample: [
      'name,slug,dimension,client,constructs,description,definition,is_active,is_match_eligible,indicators_low,indicators_mid,indicators_high',
      '"Strategic Influence",strategic-influence,drive-delivery,,"stakeholder-framing:1;strategic-signalling:0.8","Shapes direction across stakeholders","Influences decisions and aligns effort",true,true,"Reactive and narrow","Balances priorities","Creates alignment and momentum"',
    ].join('\n'),
    notes: [
      'Accepted fields: name, slug, dimension, client, constructs, description, definition, is_active, is_match_eligible, indicators_low, indicators_mid, indicators_high.',
      'Construct links use semicolon-separated entries like stakeholder-framing:1;strategic-signalling:0.8.',
    ],
  },
  constructs: {
    title: 'Bulk Import Constructs',
    description:
      'Upload construct rows and optionally link each construct to one parent factor by name, slug, or ID.',
    sample: [
      'name,slug,factor,description,definition,is_active,indicators_low,indicators_mid,indicators_high',
      '"Stakeholder Framing",stakeholder-framing,strategic-influence,"Frames ideas for different audiences","Tailors messages to influence different stakeholders",true,"One-size-fits-all communication","Adapts to some audiences","Tailors messages precisely"',
    ].join('\n'),
    notes: [
      'Accepted fields: name, slug, factor, description, definition, is_active, indicators_low, indicators_mid, indicators_high.',
      'Factor linkage is optional in this import path.',
    ],
  },
  items: {
    title: 'Bulk Import Items',
    description:
      'Upload item rows. Construct items need a construct reference and every item needs an active response format.',
    sample: [
      'stem,purpose,construct,response_format,reverse_scored,weight,status,display_order,keyed_answer',
      '"I adapt my message to suit different audiences.",construct,stakeholder-framing,"Likert 5",false,1,active,0,',
    ].join('\n'),
    notes: [
      'Accepted fields: stem, purpose, construct, response_format, reverse_scored, weight, status, display_order, keyed_answer.',
      'Construct can resolve by slug, name, or ID. Response format can resolve by name or ID.',
    ],
  },
}

export function LibraryBulkImportButton({
  entity,
}: {
  entity: BulkImportEntity
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ImportStep>('prepare')
  const [rawText, setRawText] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [aiExpanded, setAIExpanded] = useState(false)
  const [importSourceLabel, setImportSourceLabel] = useState<string | null>(null)
  const [importSourceKind, setImportSourceKind] = useState<'file' | 'ai' | null>(null)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [isImportPending, startImportTransition] = useTransition()
  const [isAIStructuring, startAIStructuringTransition] = useTransition()
  const config = IMPORT_CONFIG[entity]

  const previewLines = useMemo(() => {
    return rawText
      .trim()
      .split(/\r?\n/)
      .slice(0, 12)
      .join('\n')
  }, [rawText])

  const detectedRowCount = useMemo(() => {
    const lines = rawText.trim().split(/\r?\n/).filter(Boolean)
    return Math.max(lines.length - 1, 0)
  }, [rawText])

  const errorCount = useMemo(
    () => (!result || result.success ? 0 : result.errors.length),
    [result]
  )

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    setRawText(text)
    setImportSourceLabel(file.name)
    setImportSourceKind('file')
    setResult(null)
    setStep('review')
    event.target.value = ''
  }

  function handleImport() {
    if (!rawText.trim()) {
      toast.error('Upload a CSV or TSV file first.')
      return
    }

    startImportTransition(async () => {
      const nextResult = await importLibraryRows({
        entity,
        rawText,
      })
      setResult(nextResult)

      if (nextResult.success) {
        toast.success(`Imported ${nextResult.importedCount} ${entity}.`)
        return
      }

      if (nextResult.errors.length > 0) {
        toast.error(nextResult.errors[0]?.message ?? 'Import failed.')
      }
    })
  }

  function handleDownloadTemplate() {
    const blob = new Blob([config.sample], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${entity}-template.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleAIImport() {
    if (!sourceText.trim()) {
      toast.error('Paste source notes before asking AI to structure them.')
      return
    }

    startAIStructuringTransition(async () => {
      const aiResult = await structureLibraryImportWithAI({
        entity,
        sourceText,
      })

      if (!aiResult.success) {
        toast.error(aiResult.error)
        return
      }

      setRawText(aiResult.csv)
      setImportSourceLabel(`AI draft for ${entity}`)
      setImportSourceKind('ai')
      setResult(null)
      setStep('review')
      toast.success(`AI structured draft rows for ${entity}. Review them, then run import.`)
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setStep('prepare')
      setRawText('')
      setSourceText('')
      setAIExpanded(false)
      setResult(null)
      setImportSourceLabel(null)
      setImportSourceKind(null)
    }
  }

  const sourceDescriptor = importSourceKind === 'ai' ? 'AI draft' : 'Uploaded file'

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Bulk Import
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[1100px] sm:max-w-[1100px] p-0 sm:max-h-[88vh]">
          <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-xl bg-background">
            <DialogHeader className="border-b px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <DialogTitle>{config.title}</DialogTitle>
                  <DialogDescription>{config.description}</DialogDescription>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border bg-muted/30 p-1">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      step === 'prepare'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setStep('prepare')}
                  >
                    1. Prepare
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      step === 'review'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => rawText.trim() && setStep('review')}
                    disabled={!rawText.trim()}
                  >
                    2. Review & Import
                  </button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === 'prepare' ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_320px]">
                  <section className="space-y-4">
                    <div className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Upload import file</p>
                        <p className="text-sm text-muted-foreground">
                          Download the template, fill it in outside the app, then upload the
                          completed CSV or TSV here.
                        </p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/15 p-5">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label htmlFor={`${entity}-bulk-file`} className="text-sm font-medium">
                              CSV or TSV only
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Header names drive the mapping, so column order does not need to
                              match the template exactly.
                            </p>
                          </div>
                          <Input
                            id={`${entity}-bulk-file`}
                            type="file"
                            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
                            onChange={handleFileChange}
                          />
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border bg-background px-4 py-3">
                        <p className="text-sm font-medium">
                          {importSourceLabel ? 'Ready for review' : 'No file uploaded yet'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {importSourceLabel
                            ? `${sourceDescriptor}: ${importSourceLabel}`
                            : 'Upload a completed template, or use AI to structure rough source notes into a draft first.'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-card shadow-sm">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                        onClick={() => setAIExpanded((current) => !current)}
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          <WandSparkles className="size-4 text-primary" />
                          Structure with AI
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {aiExpanded ? 'Hide' : 'Optional'}
                        </span>
                      </button>
                      {aiExpanded ? (
                        <div className="border-t px-5 pb-5">
                          <div className="space-y-4 pt-5">
                            <p className="text-sm text-muted-foreground">
                              Paste messy notes or copied source text and let AI draft the import
                              file for review. Nothing is written until you explicitly run the
                              import.
                            </p>
                            <Textarea
                              id={`${entity}-bulk-ai`}
                              value={sourceText}
                              onChange={(event) => setSourceText(event.target.value)}
                              placeholder="Paste source notes, copied docs, or mixed bullet points here."
                              className="min-h-[260px] rounded-xl border-border/70 bg-background leading-6"
                            />
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs text-muted-foreground">
                                Uses the configured <span className="font-medium text-foreground">Library Import Structuring</span> model and prompt.
                              </p>
                              <Button
                                onClick={handleAIImport}
                                disabled={isAIStructuring || !sourceText.trim()}
                              >
                                <Sparkles className="size-4" />
                                {isAIStructuring ? 'Structuring…' : 'Generate draft'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Template</p>
                        <p className="text-sm text-muted-foreground">
                          Use the canonical file so imports stay predictable.
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleDownloadTemplate} className="mt-4 w-full">
                        <Download className="size-4" />
                        Download {entity} template
                      </Button>
                    </div>

                    <div className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold">
                        <FileSpreadsheet className="size-4 text-primary" />
                        Import rules
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        {config.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_320px]">
                  <section className="space-y-4">
                    <div className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">Review import payload</p>
                          <p className="text-sm text-muted-foreground">
                            Confirm the file, check the preview, then run the import.
                          </p>
                        </div>
                        {importSourceLabel ? (
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {sourceDescriptor}: {importSourceLabel}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-4 rounded-xl border bg-background p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{detectedRowCount} row{detectedRowCount === 1 ? '' : 's'} detected</span>
                          <span>•</span>
                          <span>{entity}</span>
                        </div>
                        <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/10 p-4 font-mono text-[12px] leading-6 text-foreground">
                          {previewLines || 'No preview available yet.'}
                        </pre>
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    {result?.success ? (
                      <Alert className="border-emerald-500/25 bg-emerald-500/[0.04]">
                        <CheckCircle2 className="size-4" />
                        <AlertTitle>Import completed</AlertTitle>
                        <AlertDescription>
                          Imported {result.importedCount} {entity}.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {!result?.success && result ? (
                      <Alert variant="destructive" className="border-red-500/30 bg-red-500/[0.04]">
                        <TriangleAlert className="size-4" />
                        <AlertTitle>Import blocked</AlertTitle>
                        <AlertDescription>
                          {errorCount} issue{errorCount === 1 ? '' : 's'} found.
                        </AlertDescription>
                        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-destructive/20 bg-background/80 p-3">
                          <ul className="space-y-1 text-sm">
                            {result.errors.map((error, index) => (
                              <li key={`${error.row}-${index}`}>
                                {error.row > 0 ? `Row ${error.row}: ` : ''}
                                {error.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Alert>
                    ) : (
                      <div className="rounded-2xl border bg-card p-5 shadow-sm">
                        <p className="text-sm font-semibold">Ready to import</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Run the import when the preview looks correct.
                        </p>
                      </div>
                    )}
                  </aside>
                </div>
              )}
            </div>

            <DialogFooter className="border-t px-6 py-5">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isImportPending || isAIStructuring}
              >
                Close
              </Button>
              {step === 'review' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setStep('prepare')}
                    disabled={isImportPending || isAIStructuring}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={isImportPending || isAIStructuring || !rawText.trim()}
                  >
                    {isImportPending ? 'Importing…' : 'Run import'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setStep('review')}
                  disabled={!rawText.trim() || isAIStructuring}
                >
                  Continue to review
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
