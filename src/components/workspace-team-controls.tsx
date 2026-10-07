'use client'
import { usePortal } from '@/components/portal-context'
/** Existing authorised reads remain available; only staff mutation affordances are hidden. */
export function WorkspaceTeamControls({ clientScope=false, children }: { clientScope?: boolean; children: React.ReactNode }) {
  const { portal, features }=usePortal()
  return features.teamManagement && (!clientScope || portal !== 'partner' || features.clientManagement) ? children : null
}
