'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { toggleReportTemplateDefault } from '@/app/actions/reports'

interface DefaultToggleProps {
  templateId: string
  isDefault: boolean
}

export function DefaultToggle({ templateId, isDefault: initialDefault }: DefaultToggleProps) {
  const [isDefault, setIsDefault] = useState(initialDefault)
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    setIsDefault(checked)
    startTransition(async () => {
      try {
        await toggleReportTemplateDefault(templateId, checked)
        toast.success(
          checked
            ? 'Template set as default — attached to existing campaigns'
            : 'Default flag removed',
        )
      } catch (err) {
        setIsDefault(!checked)
        toast.error(err instanceof Error ? err.message : 'Failed to update default')
      }
    })
  }

  return (
    <Switch
      checked={isDefault}
      onCheckedChange={handleToggle}
      disabled={isPending}
    />
  )
}
