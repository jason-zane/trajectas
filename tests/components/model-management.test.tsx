// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ModelManagement } from '@/app/(dashboard)/model-management/model-management'
import type { ManagedCapability } from '@/lib/library/model-management'
const { update, refresh } = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/app/actions/model-management', () => ({ updateCapabilityAvailability: update }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const capabilities: ManagedCapability[] = [
  {id:'one',slug:'judgement',name:'Judgement',definition:'Weighs evidence.',category:'Thinking',readiness:'assessment_ready',active:true,matching:true,assessment:true,public:false},
  {id:'two',slug:'draft',name:'Draft capability',definition:'',category:'Uncategorised',readiness:'draft',active:true,matching:false,assessment:false,public:false},
]
beforeEach(() => { update.mockResolvedValue({}) })
it('disables unavailable channels with reasons while retaining edit access', () => {
  render(<ModelManagement capabilities={capabilities}/>)
  expect(screen.getByRole('switch',{name:'Public library: Draft capability'})).toHaveAttribute('aria-disabled','true')
  expect(screen.getByRole('link',{name:'Judgement'})).toHaveAttribute('href','/factors/judgement/edit')
})
it('saves only the chosen channel and refreshes after success', async () => {
  render(<ModelManagement capabilities={capabilities}/>)
  fireEvent.click(screen.getByRole('switch',{name:'Public library: Judgement'}))
  await waitFor(() => expect(update).toHaveBeenCalledWith({ids:['one'],channel:'public',enabled:true}))
  await waitFor(() => expect(refresh).toHaveBeenCalled())
})
it('keeps the saved value and shows a visible error when persistence fails', async () => {
  update.mockResolvedValue({error:'Unable to save this change.'})
  render(<ModelManagement capabilities={capabilities}/>)
  fireEvent.click(screen.getByRole('switch',{name:'Public library: Judgement'}))
  expect(await screen.findByText('Unable to save this change.')).toBeVisible()
  expect(screen.getByRole('switch',{name:'Public library: Judgement'})).toHaveAttribute('aria-checked','false')
})
it('searches before selecting and bulk-enabling only the matching result', async () => {
  render(<ModelManagement capabilities={capabilities}/>)
  fireEvent.change(screen.getByRole('textbox',{name:'Find a capability…'}), { target:{value:'Judgement'} })
  await waitFor(() => expect(screen.queryByRole('link',{name:'Draft capability'})).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('checkbox',{name:'Select all'}))
  fireEvent.change(screen.getByRole('combobox',{name:'Bulk changes apply to'}),{target:{value:'public'}})
  fireEvent.click(screen.getByRole('button',{name:'Enable selected'}))
  await waitFor(() => expect(update).toHaveBeenCalledWith({ids:['one'],channel:'public',enabled:true}))
})
