import { FileText, Zap } from 'lucide-react'
import type { CampaignReportPicture } from '@/app/actions/reports'

interface Props {
  picture: CampaignReportPicture
}

/**
 * Read-only summary of which report templates will fire for sessions in this
 * campaign. Composed of L2 (assessment defaults) and, when L1+L2 are both
 * empty, L3 (platform fallback). The editable L1 list (campaign extras) is
 * rendered separately by ReportConfigPanel below this section.
 */
export function FiringReportsSection({ picture }: Props) {
  const automatic = [...picture.assessmentDefaults, ...picture.platformFallback]
  if (automatic.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Zap className="size-4" />
        </div>
        <div>
          <p className="font-semibold text-sm">Firing automatically</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {picture.platformFallback.length > 0
              ? "No reports are bound to this campaign's assessments and no extras have been added, so the platform fallback will fire when sessions complete."
              : "Reports bound as defaults on this campaign's assessments. These fire automatically when sessions complete — no campaign-level setup required."}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {automatic.map((entry, idx) => (
          <li
            key={`${entry.source}-${entry.templateId}-${idx}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{entry.templateName}</p>
              {entry.source === 'assessment' && entry.assessmentTitle ? (
                <p className="text-xs text-muted-foreground truncate">
                  from {entry.assessmentTitle}
                </p>
              ) : entry.source === 'platform' ? (
                <p className="text-xs text-muted-foreground">
                  platform fallback
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
