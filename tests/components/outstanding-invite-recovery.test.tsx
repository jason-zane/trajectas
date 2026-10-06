// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatDate } from '@/lib/formatting'
import { EXISTING_INVITE_ERROR, PENDING_INVITE_ERROR } from '@/lib/invite-status'

const calls=vi.hoisted(()=>({refresh:vi.fn(),reissue:vi.fn(),revoke:vi.fn(),invite:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:calls.refresh})}))
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn(),warning:vi.fn()}}))
vi.mock('@/app/actions/clients',()=>({reissueClientInvite:calls.reissue,revokeClientInvite:calls.revoke}))
vi.mock('@/app/actions/partners',()=>({reissuePartnerInvite:calls.reissue,revokePartnerInvite:calls.revoke}))
import { PendingInvitesSection } from '@/app/(dashboard)/clients/[slug]/users/pending-invites-section'
import { PartnerPendingInvitesSection } from '@/app/(dashboard)/partners/[slug]/users/partner-pending-invites-section'
import { ClientPortalPendingInvites } from '@/app/client/settings/users/pending-invites-section'
import { PartnerPortalPendingInvites } from '@/app/partner/settings/users/partner-pending-invites-section'
import { InviteMemberDialog } from '@/components/invite-member-dialog'

const invitations=[
  {id:'expired-record',email:'expired@example.test',role:'client_admin',createdAt:'2026-09-20T12:00:00Z',expiresAt:'2026-09-27T12:00:00Z'},
  {id:'pending-record',email:'pending@example.test',role:'client_member',createdAt:'2026-10-05T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z'},
]
const surfaces=['admin client','client portal','admin partner','partner portal'] as const
function section(surface:typeof surfaces[number],invites=invitations){
 const partners=invites.map(invite=>({...invite,role:invite.role.replace('client_','partner_')}))
 if(surface==='admin client')return <PendingInvitesSection clientId="client-a" invites={invites}/>
 if(surface==='client portal')return <ClientPortalPendingInvites workspaceId="client-a" invites={invites}/>
 if(surface==='admin partner')return <PartnerPendingInvitesSection partnerId="partner-a" invites={partners}/>
 return <PartnerPortalPendingInvites workspaceId="partner-a" invites={partners}/>
}
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(new Date('2026-10-06T12:00:00Z').getTime())
 vi.stubGlobal('IntersectionObserver',class{observe(){}unobserve(){}disconnect(){}})
})
describe('outstanding invite recovery with real filter and share dialog composition',()=>{
 it.each(surfaces)('reveals collisions hidden by either incompatible filter on %s',async surface=>{
  const view=render(<>{section(surface)}<InviteMemberDialog scope="workspace" onInvite={calls.invite}/></>)
  const user=userEvent.setup()
  for(const [filter,target,error] of [['Pending','expired',EXISTING_INVITE_ERROR],['Expired','pending',PENDING_INVITE_ERROR]] as const){
   await user.click(screen.getByRole('button',{name:`${filter} (1)`}))
   expect(screen.queryByText(`${target}@example.test`)).not.toBeInTheDocument()
   calls.invite.mockResolvedValue({error,duplicate:{inviteId:`${target}-record`}})
   await user.click(screen.getByRole('button',{name:'Invite user'}))
   await user.type(screen.getByRole('textbox',{name:'Email address'}),`${target}@example.test`)
   await user.click(screen.getByRole('button',{name:'Send invite'}))
   await user.click(await screen.findByRole('link',{name:'View outstanding invitations'}))
   expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
   expect(screen.getByRole('button',{name:'All (2)'})).toHaveAttribute('aria-pressed','true')
   expect(screen.getByText(`${target}@example.test`)).toBeInTheDocument()
  }
  expect(calls.invite).toHaveBeenCalledTimes(2)
  expect(calls.reissue).not.toHaveBeenCalled();expect(calls.revoke).not.toHaveBeenCalled()
  view.unmount()
 })
 it.each(surfaces)('keeps a reissued expired link usable and refreshes status/expiry/counts only on close on %s',async surface=>{
  const view=render(section(surface))
  const user=userEvent.setup()
  const expiry='2026-10-13T12:00:00Z'
  calls.reissue.mockResolvedValue({inviteLink:'https://example.test/invite/synthetic-only'})
  calls.refresh.mockImplementation(()=>view.rerender(section(surface,invitations.map(invite=>invite.id==='expired-record'?{...invite,expiresAt:expiry}:invite))))
  await user.click(screen.getByRole('button',{name:'Expired (1)'}))
  await user.click(within(screen.getByText('expired@example.test').closest('tr')!).getByRole('button',{name:'Copy invite link'}))
  const dialog=await screen.findByRole('dialog',{name:'Share invite link'})
  expect(within(dialog).getByRole('textbox',{name:'Invite link'})).toHaveValue('https://example.test/invite/synthetic-only')
  await user.click(within(dialog).getByRole('button',{name:'Copy invite link'}))
  expect(calls.refresh).not.toHaveBeenCalled()
  expect(dialog).toBeInTheDocument()
  expect(screen.getByText('expired@example.test')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button',{name:'Done'}))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.refresh).toHaveBeenCalledOnce()
  expect(calls.reissue).toHaveBeenCalledOnce()
  const row=screen.getByText('expired@example.test').closest('tr')!
  expect(within(row).getByText('Pending')).toBeInTheDocument()
  expect(within(row).getByText(formatDate(expiry))).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Pending (2)'})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Expired (0)'})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'All (2)'})).toHaveAttribute('aria-pressed','true')
  expect(calls.revoke).not.toHaveBeenCalled();expect(calls.invite).not.toHaveBeenCalled()
 })
})
