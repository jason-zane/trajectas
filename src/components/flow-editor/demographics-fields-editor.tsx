"use client"

import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { DemographicsConfig, DemographicsFieldConfig } from "@/lib/experience/types"

interface DemographicsFieldsEditorProps {
  config: DemographicsConfig
  onChange: (config: DemographicsConfig) => void
}

export function DemographicsFieldsEditor({
  config,
  onChange,
}: DemographicsFieldsEditorProps) {
  function updateField(index: number, updates: Partial<DemographicsFieldConfig>) {
    const fields = [...config.fields]
    fields[index] = { ...fields[index], ...updates }
    onChange({ ...config, fields })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Configure which demographic fields participants are asked to complete.
      </p>

      {config.fields.map((field, idx) => (
        <div
          key={field.key}
          className="flex items-center gap-4 rounded-lg border border-border p-3"
        >
          <Switch
            checked={field.enabled}
            onCheckedChange={(v) => updateField(idx, { enabled: v })}
          />
          <div className="flex-1 min-w-0">
            <Input
              value={field.label}
              onChange={(e) => updateField(idx, { label: e.target.value })}
              className="text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Required
            </Label>
            <Switch
              checked={field.required}
              onCheckedChange={(v) => updateField(idx, { required: v })}
              disabled={!field.enabled}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
