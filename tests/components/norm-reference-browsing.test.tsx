// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReferenceChooser } from '@/components/norms/reference-chooser'
import { NormReferenceTable } from '@/components/norms/norm-reference-table'
import { referenceOption } from '../fixtures/norm-reference-options'
import type { ReferenceOption } from '@/lib/norms/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/app/actions/norm-references', () => ({ updateReferenceReview: vi.fn(), createReferenceVersion: vi.fn() }))
vi.mock('@/components/norms/reference-refresh-dialog', () => ({ ReferenceRefreshDialog: () => null }))

const active = referenceOption({ isDefault: true })
const draft = referenceOption({ id: 'australia-draft', status: 'draft', version: 'preparation-v1' })
const uk = referenceOption({ id: 'uk', groupKey: 'country-uk', name: 'United Kingdom, ages 25–64', countryLabels: ['UK'], ageBoundsInclusive: [25, 64] })

function Chooser({ references = [uk, active], initial = null, pinnedId = null, disabled = false }: { references?: ReferenceOption[]; initial?: string | null; pinnedId?: string | null; disabled?: boolean }) {
  const [value, setValue] = useState(initial)
  return <ReferenceChooser references={references} value={value} onChange={setValue} pinnedId={pinnedId} disabled={disabled} />
}

describe('norm group browsing', () => {
  it('shows a group once by default while retaining both versions and the review view', () => {
    render(<NormReferenceTable references={[draft, active]} />)
    expect(screen.getAllByText(active.name, { exact: true })).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('1 of 1 norm groups')
    fireEvent.click(screen.getByRole('button', { name: `Versions for ${active.name}` }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(active.version, { exact: true, selector: 'p' })).toBeVisible()
    expect(within(dialog).getByText(draft.version, { exact: true, selector: 'p' })).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('tab', { name: /Needs review/ }))
    expect(screen.getAllByText(active.name, { exact: true })).toHaveLength(1)
    expect(screen.getByText('Draft', { exact: true })).toBeVisible()
  })

  it('uses combined readable search in the catalog and clears it with Reset', () => {
    render(<NormReferenceTable references={[draft, active, uk]} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search norm groups' }), { target: { value: 'AU 18-64' } })
    expect(screen.getByText(active.name, { exact: true })).toBeVisible()
    expect(screen.queryByText(uk.name, { exact: true })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 norm groups')
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText(uk.name, { exact: true })).toBeVisible()
  })

  it('always displays Assessment and filters groups by their assigned assessment', async () => {
    const user = userEvent.setup()
    const other = { ...uk, assessments: [{ id: 'other-assessment', title: 'Another personality assessment', isDefault: false }] }
    render(<NormReferenceTable references={[draft, active, other]} />)
    await user.click(screen.getByRole('combobox', { name: 'Assessment' }))
    await user.click(screen.getByRole('option', { name: 'Another personality assessment' }))
    expect(screen.getByText(uk.name, { exact: true })).toBeVisible()
    expect(screen.queryByText(active.name, { exact: true })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 norm groups')
  })

  it('lists the assessment default first and preserves a selection outside search filters', () => {
    render(<Chooser initial={active.id} />)
    expect(screen.getByRole('combobox', { name: 'Assessment' })).toBeVisible()
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('value', active.id)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search norm groups' }), { target: { value: 'UK 25-64' } })
    expect(screen.getByRole('radio', { name: /Australia/ })).toBeChecked()
    expect(screen.getByText(/outside these filters/)).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: /United Kingdom/ }))
    expect(screen.getByRole('radio', { name: /United Kingdom/ })).toBeChecked()
    expect(screen.queryByRole('radio', { name: /Australia/ })).toBeNull()
  })

  it('combines the same geography and age controls in a chooser and resets them', async () => {
    const user = userEvent.setup()
    render(<Chooser />)
    screen.getByRole('combobox', { name: 'Country / geography' }).focus()
    await user.keyboard('{ArrowDown}')
    await user.click(await screen.findByRole('option', { name: 'Australia' }))
    expect(screen.getByRole('radio', { name: /Australia/ })).toBeVisible()
    expect(screen.queryByRole('radio', { name: /United Kingdom/ })).toBeNull()
    screen.getByRole('combobox', { name: 'Age range' }).focus()
    await user.keyboard('{ArrowDown}')
    await user.click(await screen.findByRole('option', { name: 'Ages 25–64' }))
    expect(screen.getByText('No matching norm groups')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByRole('radio', { name: /United Kingdom/ })).toBeVisible()
    expect(screen.getByRole('radio', { name: /Australia/ })).toBeVisible()
  })

  it('keeps a pinned earlier version selectable, exposes other versions and never auto-replaces it', () => {
    const old = referenceOption({ id: 'old', status: 'superseded', version: 'old-v1', isDefault: false })
    render(<Chooser references={[active, old]} initial={old.id} pinnedId={old.id} />)
    expect(screen.getByRole('radio', { name: /old-v1/ })).toBeChecked()
    expect(screen.getByText('Pinned earlier version')).toBeVisible()
    fireEvent.click(screen.getByText('Other versions (1)'))
    fireEvent.click(screen.getByRole('radio', { name: /preview-v2/ }))
    expect(screen.getByRole('radio', { name: /preview-v2/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /old-v1/ })).not.toBeChecked()
  })

  it('shows a useful empty state and respects disabled selection and filtering', () => {
    const { rerender } = render(<Chooser />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search norm groups' }), { target: { value: 'no-such-country' } })
    expect(screen.getByText('No matching norm groups')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    rerender(<Chooser disabled />)
    expect(screen.getByRole('textbox', { name: 'Search norm groups' })).toBeDisabled()
    screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled())
    screen.getAllByRole('combobox').forEach(filter => expect(filter).toBeDisabled())
  })
})
