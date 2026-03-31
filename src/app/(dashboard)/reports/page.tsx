import Link from 'next/link'
import { FileText, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollReveal } from '@/components/scroll-reveal'
import { getAllReadySnapshots } from '@/app/actions/reports'
import type { ReportSnapshotStatus, ReportAudienceType } from '@/types/database'

const STATUS_META: Record<
  ReportSnapshotStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'text-muted-foreground' },
  generating: { label: 'Generating', className: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20' },
  ready: { label: 'Ready', className: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  released: { label: 'Released', className: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  failed: { label: 'Failed', className: 'text-destructive bg-destructive/10 border-destructive/20' },
}

const AUDIENCE_LABELS: Record<ReportAudienceType, string> = {
  participant: 'Participant',
  hr_manager: 'HR Manager',
  consultant: 'Consultant',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

export default async function ReportsPage() {
  const snapshots = await getAllReadySnapshots()

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Generated report snapshots. Click a report to preview or release."
      />

      <ScrollReveal>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">No reports yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Reports are generated automatically when participants complete campaigns with report
                  templates configured.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="hidden sm:table-cell">Generated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => {
                  const statusMeta = STATUS_META[snapshot.status]
                  return (
                    <TableRow key={snapshot.id} className="group">
                      <TableCell>
                        <Link
                          href={`/reports/${snapshot.id}`}
                          className="flex items-center gap-3 -my-1"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight font-mono text-xs text-muted-foreground">
                              {snapshot.id.slice(0, 8)}…
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Session {snapshot.participantSessionId.slice(0, 8)}…
                            </p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {AUDIENCE_LABELS[snapshot.audienceType] ?? snapshot.audienceType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusMeta.className}>
                          {statusMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground capitalize">
                          {snapshot.narrativeMode.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {snapshot.generatedAt ? formatDate(snapshot.generatedAt) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/reports/${snapshot.id}`}>
                          <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </ScrollReveal>
    </div>
  )
}
