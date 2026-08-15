'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/**
 * Downloads the technical report PDF.
 *
 * The PDF is produced from the same assembled report model the page renders, so
 * the document handed to a customer cannot disagree with what was on screen.
 */
export function DownloadReportButton({ buildId }: { buildId: string }) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const response = await fetch(
        `/api/instruments/${buildId}/technical-report-pdf`
      )
      if (!response.ok) {
        throw new Error(`PDF generation failed (${response.status})`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `technical-report-${buildId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('Could not generate the PDF', {
        description:
          error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button onClick={handleDownload} disabled={isDownloading} className="gap-2">
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isDownloading ? 'Generating…' : 'Download PDF'}
    </Button>
  )
}
