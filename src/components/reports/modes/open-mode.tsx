'use client'
import { cn } from '@/lib/utils'

export function OpenMode({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-mode="open" className={cn('px-10 py-9', className)}>
      {children}
    </div>
  )
}
