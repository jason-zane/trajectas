// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebhookBacklogReviewPanel } from '@/components/webhook-backlog-review'
const calls=vi.hoisted(()=>({release:vi.fn()}))
vi.mock('@/app/actions/webhook-backlog',()=>({releaseWebhookBacklogAction:calls.release}))
const initial={deliveryEnabled:true,hasMore:true,events:[{id:'synthetic',eventType:'integration.launch.created',createdAt:'2026-10-07',heldAt:'2026-10-07',attempts:2}]}
beforeEach(()=>calls.release.mockReset())
describe('explicit saved event review',()=>{
 it('requires review, allows cancellation and schedules exactly the shown batch after confirmation',async()=>{
  calls.release.mockResolvedValue({count:1})
  render(<WebhookBacklogReviewPanel clientId="synthetic-client" initial={initial}/>)
  expect(screen.queryByRole('button',{name:'Release reviewed batch'})).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button',{name:'Review saved events'}))
  expect(calls.release).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button',{name:'Cancel'}))
  expect(calls.release).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button',{name:'Review saved events'}))
  await userEvent.click(screen.getByRole('button',{name:'Release reviewed batch'}))
  await waitFor(()=>expect(calls.release).toHaveBeenCalledExactlyOnceWith('synthetic-client',['synthetic']))
  expect(await screen.findByText(/Reviewed events are queued/)).toBeInTheDocument()
 })
 it('keeps release disabled while client delivery is paused',async()=>{
  render(<WebhookBacklogReviewPanel clientId="synthetic-client" initial={{...initial,deliveryEnabled:false}}/>)
  await userEvent.click(screen.getByRole('button',{name:'Review saved events'}))
  expect(screen.getByRole('button',{name:'Release reviewed batch'})).toBeDisabled()
  expect(calls.release).not.toHaveBeenCalled()
 })
 it('retains the reviewed batch when the server rejects a stale proposal',async()=>{
  calls.release.mockResolvedValue({error:'Saved events changed. Refresh and review the new batch'})
  render(<WebhookBacklogReviewPanel clientId="synthetic-client" initial={initial}/>)
  await userEvent.click(screen.getByRole('button',{name:'Review saved events'}))
  await userEvent.click(screen.getByRole('button',{name:'Release reviewed batch'}))
  expect(await screen.findByText('Saved events changed. Refresh and review the new batch')).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Cancel'})).toBeInTheDocument()
 })
})
