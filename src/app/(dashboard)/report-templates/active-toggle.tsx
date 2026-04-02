'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { toggleReportTemplateActive } from '@/app/actions/reports'

interface ActiveToggleProps {
  templateId: string
  isActive: boolean
}

export function ActiveToggle({ templateId, isActive: initialActive }: ActiveToggleProps) {
  const [isActive, setIsActive] = useState(initialActive)
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    setIsActive(checked) // optimistic
    startTransition(async () => {
      try {
        await toggleReportTemplateActive(templateId, checked)
        toast.success(checked ? 'Template activated' : 'Template deactivated')
      } catch (err) {
        setIsActive(!checked) // revert on error
        toast.error(err instanceof Error ? err.message : 'Failed to update status')
      }
    })
  }

  return (
    <Switch
      checked={isActive}
      onCheckedChange={handleToggle}
      disabled={isPending}
    />
  )
}
