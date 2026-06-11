/**
 * Surface-specific configuration for the WorkspaceUsersPage component.
 * Each surface (client/partner) provides its own fetch functions, table component,
 * and dialog components, but the page-level scaffolding is shared.
 */
export interface WorkspaceUsersSurface {
  /** The workspace ID (clientId or partnerId) */
  workspaceId: string

  /** The table component to render. Receives workspaceId and members. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TableComponent: React.ComponentType<any>

  /** The invite dialog component. Receives workspaceId. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InviteDialog: React.ComponentType<any>

  /** The pending invites section component. Receives workspaceId and invites. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PendingInvitesComponent: React.ComponentType<any> | null

  /** Members data from server-side fetch */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  members: any[]

  /** Pending invites data from server-side fetch */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingInvites: any[]
}

/**
 * Shared page-level component for workspace users management.
 * Handles common scaffolding; surface-specific table and dialog
 * components are provided by configuration.
 *
 * Auth is handled by the wrapper page.tsx — this component assumes
 * resolveClientOrg / resolvePartnerOrg has already been called and
 * auth checks (canManageClient / canManagePartner) have passed.
 */
export function WorkspaceUsersPage({
  surface,
}: {
  surface: WorkspaceUsersSurface
}) {
  const {
    workspaceId,
    TableComponent,
    InviteDialog,
    PendingInvitesComponent,
    members,
    pendingInvites,
  } = surface

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section">Team Members</h2>
          <p className="text-caption mt-0.5">
            Invite, promote, and remove people from your workspace.
          </p>
        </div>
        <InviteDialog workspaceId={workspaceId} />
      </div>

      <TableComponent workspaceId={workspaceId} members={members} />

      {PendingInvitesComponent && pendingInvites.length > 0 && (
        <PendingInvitesComponent
          workspaceId={workspaceId}
          invites={pendingInvites}
        />
      )}
    </div>
  )
}
