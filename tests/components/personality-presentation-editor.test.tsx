// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
const save=vi.hoisted(()=>vi.fn(async()=>({updatedAt:'2026-10-30T02:00:00Z'})))
vi.mock('@/app/actions/personality-report-presentation',()=>({updatePersonalityReportPresentation:save}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}))
vi.mock('@/hooks/use-unsaved-changes',()=>({useUnsavedChanges:()=>({showDialog:false,cancelNavigation:vi.fn(),confirmNavigation:vi.fn()})}))
vi.mock('@/components/ui/confirm-dialog',()=>({ConfirmDialog:()=>null}))
import { PersonalityPresentationEditor } from '@/components/reports/custom/personality-standard/presentation-editor'
describe('personality report presentation editing',()=>{
 it('allows clearing and replacing the default headline without restoring or appending it',async()=>{
  render(<PersonalityPresentationEditor id="template" name="Standard" updatedAt="2026-10-30T01:00:00Z" />)
  const field=screen.getByLabelText('Cover headline')
  fireEvent.change(field,{target:{value:''}})
  expect(field).toHaveValue('')
  fireEvent.change(field,{target:{value:'Edited headline'}})
  expect(field).toHaveValue('Edited headline')
  fireEvent.click(screen.getByRole('button',{name:'Save presentation'}))
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({presentation:expect.objectContaining({coverHeadline:'Edited headline'})})))
 })
 it('keeps invalid transient copy in the form and refuses it on explicit save',async()=>{
  render(<PersonalityPresentationEditor id="template" name="Standard" updatedAt="2026-10-30T01:00:00Z" />)
  fireEvent.change(screen.getByLabelText('Cover headline'),{target:{value:''}})
  fireEvent.click(screen.getByRole('button',{name:'Save presentation'}))
  await waitFor(()=>expect(screen.getByRole('alert')).toBeVisible())
  expect(save).not.toHaveBeenCalled()
 })
})
