'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { applyWorkspaceFeatureChange, updateWorkspaceFeature } from '@/app/actions/workspace-features'
import { previewFeatureChange, INSIGHT_FEATURES, MODULE_FEATURES, type FeatureTenant, type WorkspaceFeatures, type FeatureSettingKey } from '@/lib/features/workspace-features'
import { WORKSPACE_PRESETS, workspacePreset, workspaceFeatureDiff, type WorkspacePresetId } from '@/lib/features/workspace-presets'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
export function WorkspaceFeatureSettings({ tenant, initial }: { tenant: FeatureTenant; initial: WorkspaceFeatures }) {
  const [features, setFeatures] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [proposal, setProposal] = useState<{ change: { key: FeatureSettingKey; value: boolean | WorkspaceFeatures['dashboardStyle'] } | { preset: WorkspacePresetId }; next: WorkspaceFeatures } | null>(null)
  function change(key: FeatureSettingKey, value: boolean | WorkspaceFeatures['dashboardStyle']) {
    let next: WorkspaceFeatures
    try { next = previewFeatureChange(features, key, value, true) }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Invalid feature combination.'; setError(message); toast.error(message); return }
    if (workspaceFeatureDiff(features, next).some(entry => entry.key !== key)) { setProposal({ change: { key, value }, next }); return }
    startTransition(async () => {
      setError(null)
      try {
        const result = await updateWorkspaceFeature(tenant, { key, value })
        if ('error' in result) { setError(result.error); toast.error(result.error); return }
        setFeatures(result.features)
        toast.success('Workspace features updated')
      } catch {
        const message = 'Unable to update workspace features. Please try again.'
        setError(message)
        toast.error(message)
      }
    })
  }
  function applyProposal() {
    if (!proposal) return
    startTransition(async () => {
      try {
        const result = await applyWorkspaceFeatureChange(tenant, features, proposal.change)
        if ('error' in result) { setError(result.error); toast.error(result.error); return }
        setFeatures(result.features); setProposal(null); setError(null); toast.success('Workspace features updated')
      } catch { setError('Unable to update workspace features.'); toast.error('Unable to update workspace features.') }
    })
  }
  return <div className="space-y-6" aria-busy={pending}>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Provisioning presets</CardTitle><CardDescription>Version 1 choices. Review every change before applying; insights remain independent.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap gap-3">{WORKSPACE_PRESETS.filter(p => p.tenantType === tenant.type).map(p => <Button key={p.id} variant="outline" disabled={pending || !!proposal} onClick={() => setProposal({ change: { preset: p.id }, next: workspacePreset(p.id, tenant.type) })}>Review {p.label}</Button>)}</CardContent>
    </Card>
    {proposal && <Alert variant="warning"><AlertDescription>
      <p className="font-semibold">Review feature changes</p>
      <ul className="my-3 space-y-1">{workspaceFeatureDiff(features, proposal.next).map(entry => <li key={entry.key}>{[...INSIGHT_FEATURES, ...MODULE_FEATURES].find(f => f.key === entry.key)?.label ?? 'Dashboard style'}: {String(entry.before)} → {String(entry.after)}</li>)}</ul>
      <div className="flex gap-3"><Button disabled={pending} onClick={applyProposal}>Apply reviewed changes</Button><Button variant="outline" disabled={pending} onClick={() => setProposal(null)}>Cancel</Button></div>
    </AlertDescription></Alert>}
    <Card>
      <CardHeader><CardTitle>Dashboard experience</CardTitle><CardDescription>Choose how this workspace presents its activity. Data access and staff permissions stay the same.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="dashboard-style">Dashboard style</Label>
        <select id="dashboard-style" value={features.dashboardStyle} disabled={pending || !!proposal}
          onChange={event => change('dashboardStyle', event.target.value as WorkspaceFeatures['dashboardStyle'])}
          className="block w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
          <option value="default">Current workspace dashboard</option>
          <option value="operational">Operational — campaigns and participant activity</option>
          {tenant.type === 'partner' && <option value="portfolio">Partner — clients and assessment allocation</option>}
        </select>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Insights</CardTitle><CardDescription>Enable each tool independently. Changes apply to menus, pages, and new insight operations. Existing records are retained.</CardDescription></CardHeader>
      <CardContent className="divide-y divide-border">
        {INSIGHT_FEATURES.map(feature => {
          return <div key={feature.key} className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
            <div className="space-y-1"><Label htmlFor={`feature-${feature.key}`}>{feature.label}</Label>
              <p id={`description-${feature.key}`} className="text-sm text-muted-foreground">{feature.description}</p></div>
            <Switch id={`feature-${feature.key}`} aria-describedby={`description-${feature.key}`} checked={features[feature.key]} disabled={pending || !!proposal} onCheckedChange={value => change(feature.key, value)} />
          </div>
        })}
      </CardContent>
    </Card>
    {[...new Set(MODULE_FEATURES.map(f => f.group))].map(group => <Card key={group}>
      <CardHeader><CardTitle>{group}</CardTitle><CardDescription>Availability combines with existing staff permissions, allocations and quotas.</CardDescription></CardHeader>
      <CardContent className="divide-y divide-border">
        {MODULE_FEATURES.filter(f => f.group === group && (tenant.type === 'partner' || !('partnerOnly' in f))).map(feature => <div key={feature.key} className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
          <div className="space-y-1"><Label htmlFor={`feature-${feature.key}`}>{feature.label}</Label><p id={`description-${feature.key}`} className="text-sm text-muted-foreground">{feature.description}</p></div>
          <Switch id={`feature-${feature.key}`} aria-describedby={`description-${feature.key}`} checked={features[feature.key]} disabled={pending || !!proposal} onCheckedChange={value => change(feature.key, value)} />
        </div>)}
      </CardContent>
    </Card>)}
    <p className="text-sm text-muted-foreground">Assessment allocations, report template allocations, quotas, and branding remain in their existing tabs. These switches do not grant access to another organisation’s data.</p>
  </div>
}
