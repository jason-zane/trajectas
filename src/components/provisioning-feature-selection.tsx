'use client'
import { useState } from 'react'
import { workspaceFeatureLabel, MODULE_FEATURES, INSIGHT_FEATURES, FEATURE_DEPENDENCIES, previewFeatureChange, type FeatureTenant, type WorkspaceFeatures } from '@/lib/features/workspace-features'
import { WORKSPACE_PRESETS, workspacePreset, workspaceFeatureDiff, type WorkspacePresetId } from '@/lib/features/workspace-presets'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
/** Unsaved provisioning configuration; creating the organisation commits it in one transaction. */
export function ProvisioningFeatureSelection({ type }: { type: FeatureTenant['type'] }) {
  const initialPreset = type === 'client' ? 'client' : 'partnerStarter'
  const [preset, setPreset] = useState<WorkspacePresetId>(initialPreset)
  const [features, setFeatures] = useState<WorkspaceFeatures>(() => workspacePreset(initialPreset, type))
  const [error, setError] = useState<string | null>(null)
  return <fieldset className="space-y-4 rounded-lg border border-border p-4">
    <legend className="px-2 font-semibold">Features at creation</legend>
    <input type="hidden" name="featurePreset" value={preset} />
    <input type="hidden" name="featureConfiguration" value={JSON.stringify(features)} />
    <Label htmlFor="provisioning-preset">Preset (version 1)</Label>
    <select id="provisioning-preset" className="block w-full rounded-md border border-input bg-background p-2" value={preset} onChange={event => {
      const id = event.target.value as WorkspacePresetId
      setPreset(id); setFeatures(workspacePreset(id, type)); setError(null)
    }}>{WORKSPACE_PRESETS.filter(p => p.tenantType === type).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
    <Label htmlFor="provisioning-dashboard">Dashboard style</Label>
    <select id="provisioning-dashboard" className="block w-full rounded-md border border-input bg-background p-2" value={features.dashboardStyle} onChange={event => setFeatures({ ...features, dashboardStyle: event.target.value as WorkspaceFeatures['dashboardStyle'] })}>
      <option value="default">Current dashboard</option><option value="operational">Operational</option>{type === 'partner' && <option value="portfolio">Partner portfolio</option>}
    </select>
    <p className="text-sm text-muted-foreground">Select capabilities before creating this workspace. Allocations, quotas and staff roles are managed separately. Disabling a prerequisite also disables its dependents in this unsaved configuration.</p>
    {error && <Alert variant="warning"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid gap-3 sm:grid-cols-2">{[...INSIGHT_FEATURES, ...MODULE_FEATURES].filter(f => type === 'partner' || !('partnerOnly' in f)).map(feature => <label key={feature.key} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={features[feature.key]} onChange={event => {
        const dependencies = FEATURE_DEPENDENCIES[feature.key] ?? []
        if (event.target.checked && dependencies.some(key => !features[key])) { setError(`Enable ${dependencies.map(workspaceFeatureLabel).join(', ')} first.`); return }
        setError(null); setFeatures(previewFeatureChange(features, feature.key, event.target.checked))
      }} />{feature.label}
    </label>)}</div>
    <p className="text-sm text-muted-foreground">Individual overrides from this preset: {workspaceFeatureDiff(workspacePreset(preset, type), features).map(change => `${workspaceFeatureLabel(change.key)}: ${change.after}`).join(', ') || 'None'}</p>
  </fieldset>
}
