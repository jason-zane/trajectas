'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateWorkspaceFeature } from '@/app/actions/workspace-features'
import { INSIGHT_FEATURES, type FeatureTenant, type WorkspaceFeatures, type FeatureSettingKey } from '@/lib/features/workspace-features'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
export function WorkspaceFeatureSettings({ tenant, initial }: { tenant: FeatureTenant; initial: WorkspaceFeatures }) {
  const [features, setFeatures] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  function change(key: FeatureSettingKey, value: boolean | WorkspaceFeatures['dashboardStyle']) {
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
  return <div className="space-y-6" aria-busy={pending}>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Card>
      <CardHeader><CardTitle>Dashboard experience</CardTitle><CardDescription>Choose how this workspace presents its activity. Data access and staff permissions stay the same.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="dashboard-style">Dashboard style</Label>
        <select id="dashboard-style" value={features.dashboardStyle} disabled={pending}
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
          const unavailable = tenant.type === 'client' && feature.key === 'unifiedTrajectory'
          return <div key={feature.key} className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
            <div className="space-y-1"><Label htmlFor={`feature-${feature.key}`}>{feature.label}</Label>
              <p id={`description-${feature.key}`} className="text-sm text-muted-foreground">{unavailable ? 'Available in partner workspaces. Client portal support is planned separately.' : feature.description}</p></div>
            <Switch id={`feature-${feature.key}`} aria-describedby={`description-${feature.key}`} checked={!unavailable && features[feature.key]} disabled={pending || unavailable} onCheckedChange={value => change(feature.key, value)} />
          </div>
        })}
      </CardContent>
    </Card>
    <p className="text-sm text-muted-foreground">Assessment allocations, report template allocations, quotas, and branding remain in their existing tabs. These switches do not grant access to another organisation’s data.</p>
  </div>
}
