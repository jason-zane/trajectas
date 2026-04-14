'use client'

import { cn } from '@/lib/utils'
import { MiniBar } from './mini-bar'
import { BandBadge } from './band-badge'

interface ScorecardTableProps {
  items: {
    name: string
    parentName: string
    value: number
    band: 'high' | 'mid' | 'low'
    bandLabel: string
  }[]
  className?: string
}

export function ScorecardTable({ items, className }: ScorecardTableProps) {
  const showParent = items.some((i) => i.parentName)

  return (
    <table className={cn('w-full border-collapse', className)}>
      <thead>
        <tr
          className="text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--report-muted-colour)', borderBottom: '1px solid var(--report-divider)' }}
        >
          <th className="text-left pb-2 font-medium pr-4">Name</th>
          {showParent && <th className="text-left pb-2 font-medium pr-4">Parent</th>}
          <th className="text-left pb-2 font-medium pr-4" style={{ width: '160px' }}>Score</th>
          <th className="text-center pb-2 font-medium">Band</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr
            key={item.name}
            style={{
              borderBottom: i < items.length - 1 ? '1px solid var(--report-divider)' : undefined,
            }}
          >
            <td className="py-3 pr-4">
              <span
                className="text-[13px] font-medium"
                style={{ color: 'var(--report-heading-colour)' }}
              >
                {item.name}
              </span>
            </td>
            {showParent && (
              <td className="py-3 pr-4">
                <span
                  className="text-[12px]"
                  style={{ color: 'var(--report-muted-colour)' }}
                >
                  {item.parentName}
                </span>
              </td>
            )}
            <td className="py-3 pr-4" style={{ width: '160px' }}>
              <MiniBar value={item.value} band={item.band} />
            </td>
            <td className="py-3 text-center">
              <BandBadge band={item.band} label={item.bandLabel} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
