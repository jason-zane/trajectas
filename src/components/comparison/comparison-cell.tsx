import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export function ComparisonCell({
  value,
  style,
  isRollup = false,
}: {
  value: number | null
  style: CSSProperties
  isRollup?: boolean
}) {
  return (
    <td
      className={cn(
        'text-center font-semibold text-[11px] min-w-[36px] max-w-[36px] px-2 py-1.5 border-b border-r border-border last:border-r-0',
        isRollup && 'font-extrabold border-l-2 border-l-border/40',
      )}
      style={style}
    >
      {value === null ? <span className="opacity-60">—</span> : value}
    </td>
  )
}
