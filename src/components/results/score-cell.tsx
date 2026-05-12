import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared score-cell renderer used by both the Compare matrix and the
 * Trajectory matrix. Renders a numeric score or an em-dash for null.
 *
 * `isRollup` styles the cell as a parent (heavier text + accent border on
 * the left edge). Used by Compare for the dimension/factor rollup column.
 * Trajectory may use it for parent entities when showing factor totals
 * alongside their constructs.
 */
export function ScoreCell({
  value,
  style,
  isRollup = false,
}: {
  value: number | null
  style?: CSSProperties
  isRollup?: boolean
}) {
  return (
    <td
      className={cn(
        'text-center font-semibold text-[11px] min-w-[36px] px-2 py-1.5 border-b border-r border-border last:border-r-0',
        isRollup && 'font-extrabold border-l-2 border-l-border/40',
      )}
      style={style}
    >
      {value === null ? <span className="opacity-60">—</span> : value}
    </td>
  )
}
