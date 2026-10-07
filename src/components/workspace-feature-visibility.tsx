'use client'
import { usePortal } from '@/components/portal-context'
import type { WorkspaceFeature } from '@/lib/features/workspace-features'
/** Presentation only. Every corresponding server operation checks fresh availability. */
export function WorkspaceFeatureVisibility({ features: required = [], when = true, fallback = null, children }: { features?: WorkspaceFeature[]; when?: boolean; fallback?: React.ReactNode; children: React.ReactNode }) {
  const { features } = usePortal()
  return when && required.every(feature => features[feature]) ? children : fallback
}
