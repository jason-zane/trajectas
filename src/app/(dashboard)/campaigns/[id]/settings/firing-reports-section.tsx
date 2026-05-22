import { FileText, Zap } from 'lucide-react'
import type { CampaignReportPicture, CampaignReportPictureEntry } from '@/app/actions/reports'

interface Props {
  picture: CampaignReportPicture
}

/**
 * Read-only summary of which report templates will fire for sessions in this
 * campaign, grouped by source.
 *
 * The runtime resolver in ensureReportSnapshotsForSession fires per-session
 * against the session's specific assessment — defaults are not pooled
 * campaign-wide. So in a multi-assessment campaign, a session in Assessment A
 * fires A's bound defaults, and a session in Assessment B fires B's. This UI
 * mirrors that by grouping the L2 entries by assessment, so admins see
 * exactly what each completion path produces.
 *
 * L3 (platform fallback) only appears when L1 and L2 are both empty, matching
 * the resolver. The editable L1 list lives in ReportConfigPanel below.
 */
export function FiringReportsSection({ picture }: Props) {
  const hasAssessmentDefaults = picture.assessmentDefaults.length > 0
  const hasFallback = picture.platformFallback.length > 0
  if (!hasAssessmentDefaults && !hasFallback) return null

  // Group assessment defaults by assessment for accurate "per-completion-path" framing.
  const byAssessment = new Map<
    string,
    { title: string; entries: CampaignReportPictureEntry[] }
  >()
  for (const entry of picture.assessmentDefaults) {
    const key = entry.assessmentId ?? '__unknown__'
    const title = entry.assessmentTitle ?? 'Untitled assessment'
    const existing = byAssessment.get(key)
    if (existing) existing.entries.push(entry)
    else byAssessment.set(key, { title, entries: [entry] })
  }
  const assessmentGroups = Array.from(byAssessment.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  )

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Zap className="size-4" />
        </div>
        <div>
          <p className="font-semibold text-sm">Firing automatically</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasFallback
              ? "No reports are bound to this campaign's assessments and no extras have been added, so the platform fallback will fire when sessions complete."
              : assessmentGroups.length > 1
                ? "Reports bound as defaults on this campaign's assessments. Each session fires the reports bound to its specific assessment."
                : "Reports bound as defaults on this campaign's assessment. These fire automatically when sessions complete."}
          </p>
        </div>
      </div>

      {assessmentGroups.length > 0 && (
        <div className="space-y-4">
          {assessmentGroups.map((group, idx) => (
            <div key={`g-${idx}`} className="space-y-2">
              {assessmentGroups.length > 1 && (
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  When a participant completes {group.title}
                </p>
              )}
              <ul className="space-y-2">
                {group.entries.map((entry) => (
                  <li
                    key={`${entry.templateId}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{entry.templateName}</p>
                      {assessmentGroups.length === 1 && entry.assessmentTitle ? (
                        <p className="text-xs text-muted-foreground truncate">
                          from {entry.assessmentTitle}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {hasFallback && (
        <ul className="space-y-2">
          {picture.platformFallback.map((entry) => (
            <li
              key={entry.templateId}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{entry.templateName}</p>
                <p className="text-xs text-muted-foreground">platform fallback</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
