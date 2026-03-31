'use client'

import { useMemo, useState, useTransition, type ChangeEvent } from 'react'
import { CheckCircle2, Download, Files, TriangleAlert } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { importLibraryBundleRows, type LibraryBundleImportResult } from '@/app/actions/bulk-import'

const LIBRARY_TEMPLATE = [
  'entity,name,slug,dimension,client,constructs,factor,description,definition,display_order,is_active,is_match_eligible,indicators_low,indicators_mid,indicators_high,stem,purpose,construct,response_format,reverse_scored,weight,status,keyed_answer',
  'dimension,"Drive & Delivery",drive-delivery,,,,,"Execution under pressure","Sustains focus and delivery in demanding contexts",0,true,,"Misses deadlines","Delivers consistently","Drives performance under pressure",,,,,,,,',
  'factor,"Strategic Influence",strategic-influence,drive-delivery,,"stakeholder-framing:1;strategic-signalling:0.8",,"Shapes direction across stakeholders","Influences decisions and aligns effort",,true,true,"Reactive and narrow","Balances priorities","Creates alignment and momentum",,,,,,,,',
  'construct,"Stakeholder Framing",stakeholder-framing,,,,strategic-influence,"Frames ideas for different audiences","Tailors messages to influence different stakeholders",,true,,"One-size-fits-all communication","Adapts to some audiences","Tailors messages precisely",,,,,,,,',
  'item,,,,,,,,,,,,,,,"I adapt my message to suit different audiences.",construct,stakeholder-framing,"Likert 5",false,1,active,',
].join('\n')

type ImportStep = 'prepare' | 'review'

export function LibraryBundleImportButton() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ImportStep>('prepare')
  const [rawText, setRawText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<LibraryBundleImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const totalImported = useMemo(
    () => (result && result.success ? result.totalImportedCount : 0),
    [result]
  )

  const previewLines = useMemo(() => {
    return rawText
      .trim()
      .split(/\r?\n/)
      .slice(0, 14)
      .join('\n')
  }, [rawText])

  const detectedRowCount = useMemo(() => {
    const lines = rawText.trim().split(/\r?\n/).filter(Boolean)
    return Math.max(lines.length - 1, 0)
  }, [rawText])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    setRawText(text)
    setFileName(file.name)
    setResult(null)
    setStep('review')
    event.target.value = ''
  }

  function handleDownloadTemplate() {
    const blob = new Blob([LIBRARY_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'library-template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    if (!rawText.trim()) {
      toast.error('Upload a library CSV or TSV file first.')
      return
    }

    startTransition(async () => {
      const nextResult = await importLibraryBundleRows(rawText)
      setResult(nextResult)

      if (nextResult.success) {
        toast.success(`Imported ${nextResult.totalImportedCount} library rows.`)
        return
      }

      if (nextResult.errors.length > 0) {
        toast.error(nextResult.errors[0]?.message ?? 'Library import failed.')
      }
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setStep('prepare')
      setRawText('')
      setFileName(null)
      setResult(null)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Files className="size-4" />
        Library Import
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[1100px] sm:max-w-[1100px] p-0 sm:max-h-[88vh]">
          <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-xl bg-background">
            <DialogHeader className="border-b px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <DialogTitle>Full Library Import</DialogTitle>
                  <DialogDescription>
                    Import dimensions, factors, constructs, and items from one file. The file can
                    be partial, so only include the rows you want to add.
                  </DialogDescription>
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
                        <p className="text-sm font-semibold">Upload library file</p>
                        <p className="text-sm text-muted-foreground">
                          Use the combined template when you want to import multiple library levels
                          in one pass. It supports any mix of dimensions, factors, constructs, and
                          items.
                        </p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/15 p-5">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">CSV or TSV only</p>
                          <p className="text-sm text-muted-foreground">
                            The importer uses the <span className="font-medium text-foreground">entity</span>{' '}
                            column to decide what each row represents.
                          </p>
                          <Input
                            type="file"
                            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
                            onChange={handleFileChange}
                          />
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border bg-background px-4 py-3">
                        <p className="text-sm font-medium">
                          {fileName ? 'Ready for review' : 'No file uploaded yet'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {fileName
                            ? `Uploaded file: ${fileName}`
                            : 'Download the combined template, fill in the rows you need, then upload it here.'}
                        </p>
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Combined template</p>
                        <p className="text-sm text-muted-foreground">
                          Start from the canonical file so linked imports stay predictable.
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleDownloadTemplate} className="mt-4 w-full">
                        <Download className="size-4" />
                        Download full library template
                      </Button>
                    </div>

                    <div className="rounded-2xl border bg-card p-5 shadow-sm">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold">
                        <Files className="size-4 text-primary" />
                        Import rules
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <li>Partial imports are supported.</li>
                        <li>References can point to rows already in the library.</li>
                        <li>References can also point to rows staged in the same file.</li>
                        <li>Factors can include construct links in the same batch.</li>
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
                          <p className="text-sm font-semibold">Review library payload</p>
                          <p className="text-sm text-muted-foreground">
                            Confirm the file and preview before running the import.
                          </p>
                        </div>
                        {fileName ? (
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            Uploaded file: {fileName}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-4 rounded-xl border bg-background p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{detectedRowCount} row{detectedRowCount === 1 ? '' : 's'} detected</span>
                          <span>•</span>
                          <span>Mixed library import</span>
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
                        <AlertTitle>Library import completed</AlertTitle>
                        <AlertDescription>
                          Imported {totalImported} rows across the library.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {!result?.success && result ? (
                      <Alert variant="destructive" className="border-red-500/30 bg-red-500/[0.04]">
                        <TriangleAlert className="size-4" />
                        <AlertTitle>Library import blocked</AlertTitle>
                        <AlertDescription>
                          {result.errors.length} issue{result.errors.length === 1 ? '' : 's'} found.
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
                          Run the import when the staged file looks right.
                        </p>
                      </div>
                    )}
                  </aside>
                </div>
              )}
            </div>

            <DialogFooter className="border-t px-6 py-5">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Close
              </Button>
              {step === 'review' ? (
                <>
                  <Button variant="outline" onClick={() => setStep('prepare')} disabled={isPending}>
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={isPending || !rawText.trim()}>
                    {isPending ? 'Importing…' : 'Run library import'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setStep('review')} disabled={!rawText.trim()}>
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
