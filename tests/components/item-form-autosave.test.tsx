// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateItemField: vi.fn(),
  updateItem: vi.fn(),
  router: { replace: vi.fn(), push: vi.fn() },
}))
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }))
vi.mock('@/app/actions/items', () => ({
  updateItemField: mocks.updateItemField,
  updateItem: mocks.updateItem,
  createItem: vi.fn(), deleteItem: vi.fn(), restoreItem: vi.fn(),
}))
vi.mock('@/hooks/use-unsaved-changes', () => ({
  useUnsavedChanges: () => ({ showDialog: false, confirmNavigation: vi.fn(), cancelNavigation: vi.fn() }),
}))
vi.mock('@/components/source-picker', () => ({ SourcePicker: () => null }))
vi.mock('@/app/(dashboard)/_shared/settings-tab', () => ({ SettingsTab: () => null }))

import { ItemForm } from '@/app/(dashboard)/items/item-form'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

function renderForm(initial: Partial<NonNullable<ComponentProps<typeof ItemForm>['initialData']>> = {}) {
  const { container } = render(<ItemForm mode="edit" itemId="delivered-item" constructs={[]}
    responseFormats={[]} initialData={{ purpose: 'construct', constructId: '', responseFormatId: '',
      stem: 'Original self', stemObserver: 'Original observer', reverseScored: false,
      weight: 1, status: 'draft', displayOrder: 0, difficulty: 'medium', sourceId: '', ...initial }} />)
  return {
    stem: container.querySelector<HTMLTextAreaElement>('#stem')!,
    observer: container.querySelector<HTMLTextAreaElement>('#stemObserver')!,
  }
}

function delayedRevisionWriter() {
  const first = deferred(), second = deferred()
  const rows = new Map<string, Record<string, string>>([
    ['delivered-item', { stem: 'Original self', stem_observer: 'Original observer' }],
  ])
  let calls = 0, clones = 0
  mocks.updateItemField.mockImplementation(async (id: string, field: string, value: string) => {
    const call = calls++
    if (call === 0) await first.promise
    if (call === 1) await second.promise
    const target = id === 'delivered-item' ? `revision-${++clones}` : id
    rows.set(target, { ...rows.get(id), [field]: value })
    return { success: true, id: target }
  })
  return { first, second, rows }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('item stem autosave revisions', () => {
  it('navigates after saving a validity item with no construct', async () => {
    mocks.updateItemField.mockResolvedValue({ success: true, id: 'revision-1' })
    const { stem } = renderForm({ purpose: 'attention_check', constructId: undefined })
    await act(async () => {
      fireEvent.change(stem, { target: { value: 'New validity wording' } })
      fireEvent.blur(stem)
    })
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith('/items/revision-1/edit')
  })

  it('serializes both queued stem changes onto the first returned revision', async () => {
    const writer = delayedRevisionWriter()
    const { stem, observer } = renderForm()
    await act(async () => {
      fireEvent.change(stem, { target: { value: 'New self' } })
      fireEvent.blur(stem)
      fireEvent.change(observer, { target: { value: 'New observer' } })
      fireEvent.blur(observer)
    })
    expect(mocks.updateItemField).toHaveBeenCalledTimes(1)
    expect(mocks.updateItemField).toHaveBeenNthCalledWith(1, 'delivered-item', 'stem', 'New self')

    await act(async () => { writer.first.resolve() })
    expect(mocks.updateItemField).toHaveBeenNthCalledWith(2, 'revision-1', 'stem_observer', 'New observer')
    expect(mocks.router.replace).not.toHaveBeenCalled()

    await act(async () => { writer.second.resolve() })
    expect(writer.rows.get('revision-1')).toEqual({ stem: 'New self', stem_observer: 'New observer' })
    expect(writer.rows.size).toBe(2)
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith('/items/revision-1/edit')
  })

  it('keeps a dirty observer debounce alive when the first clone returns before it dispatches', async () => {
    const writer = delayedRevisionWriter()
    const { stem, observer } = renderForm()
    await act(async () => {
      fireEvent.change(stem, { target: { value: 'New self' } })
      fireEvent.blur(stem)
      fireEvent.change(observer, { target: { value: 'Debounced observer' } })
    })
    await act(async () => { writer.first.resolve() })
    expect(mocks.updateItemField).toHaveBeenCalledTimes(1)
    expect(mocks.router.replace).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(mocks.updateItemField).toHaveBeenNthCalledWith(2, 'revision-1', 'stem_observer', 'Debounced observer')
    expect(mocks.router.replace).not.toHaveBeenCalled()
    await act(async () => { writer.second.resolve() })

    expect(writer.rows.get('revision-1')).toEqual({ stem: 'New self', stem_observer: 'Debounced observer' })
    expect(writer.rows.size).toBe(2)
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith('/items/revision-1/edit')
  })

  it('preserves a failed field for retry without blocking the other field or losing its revision', async () => {
    mocks.updateItemField.mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ success: true, id: 'revision-1' })
      .mockResolvedValueOnce({ success: true, id: 'revision-1' })
    const { stem, observer } = renderForm()
    await act(async () => {
      fireEvent.change(stem, { target: { value: 'Retry self' } })
      fireEvent.blur(stem)
      fireEvent.change(observer, { target: { value: 'Saved observer' } })
      fireEvent.blur(observer)
    })
    expect(mocks.updateItemField).toHaveBeenCalledTimes(2)
    expect(mocks.router.replace).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })) })
    expect(mocks.updateItemField).toHaveBeenNthCalledWith(3, 'revision-1', 'stem', 'Retry self')
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith('/items/revision-1/edit')
  })
})
