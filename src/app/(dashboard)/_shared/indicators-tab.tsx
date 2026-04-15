"use client"

import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/rich-text-editor"

interface IndicatorsTabProps {
  indicatorsLow: string
  indicatorsMid: string
  indicatorsHigh: string
  onChangeLow: (value: string) => void
  onChangeMid: (value: string) => void
  onChangeHigh: (value: string) => void
  onBlurLow?: () => void
  onBlurMid?: () => void
  onBlurHigh?: () => void
  /** Optional render prop for status indicators below each field. */
  statusLow?: React.ReactNode
  statusMid?: React.ReactNode
  statusHigh?: React.ReactNode
}

export function IndicatorsTab({
  indicatorsLow,
  indicatorsMid,
  indicatorsHigh,
  onChangeLow,
  onChangeMid,
  onChangeHigh,
  onBlurLow,
  onBlurMid,
  onBlurHigh,
  statusLow,
  statusMid,
  statusHigh,
}: IndicatorsTabProps) {
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Define observable behaviours at each performance level. Use bullet points for multiple indicators.
      </p>

      {/* Low */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-500/70 dark:bg-red-400/70" />
          Low Performance
        </Label>
        <RichTextEditor
          content={indicatorsLow}
          onChange={onChangeLow}
          onBlur={onBlurLow}
          placeholder="Describe low-band behaviours..."
        />
        {statusLow}
      </div>

      {/* Mid */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber-500/70 dark:bg-amber-400/70" />
          Mid Performance
        </Label>
        <RichTextEditor
          content={indicatorsMid}
          onChange={onChangeMid}
          onBlur={onBlurMid}
          placeholder="Describe mid-band behaviours..."
        />
        {statusMid}
      </div>

      {/* High */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500/70 dark:bg-emerald-400/70" />
          High Performance
        </Label>
        <RichTextEditor
          content={indicatorsHigh}
          onChange={onChangeHigh}
          onBlur={onBlurHigh}
          placeholder="Describe high-band behaviours..."
        />
        {statusHigh}
      </div>
    </div>
  )
}
