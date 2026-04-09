// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LikertResponse } from '@/components/assess/formats/likert-response'

const FIVE_OPTIONS = [
  { id: '1', label: 'Strongly Disagree', value: 1 },
  { id: '2', label: 'Disagree', value: 2 },
  { id: '3', label: 'Neutral', value: 3 },
  { id: '4', label: 'Agree', value: 4 },
  { id: '5', label: 'Strongly Agree', value: 5 },
]

describe('LikertResponse', () => {
  it('renders all options as buttons', () => {
    render(<LikertResponse options={FIVE_OPTIONS} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.getByText('Strongly Disagree')).toBeDefined()
    expect(screen.getByText('Strongly Agree')).toBeDefined()
  })

  it('uses CSS Grid with equal columns for the option count', () => {
    const { container } = render(
      <LikertResponse options={FIVE_OPTIONS} onSelect={vi.fn()} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid')
    expect(grid.className).toContain('md:grid-cols-5')
  })

  it('adapts grid columns for 3 options', () => {
    const threeOptions = FIVE_OPTIONS.slice(0, 3)
    const { container } = render(
      <LikertResponse options={threeOptions} onSelect={vi.fn()} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('md:grid-cols-3')
  })

  it('marks the selected button with aria-pressed', () => {
    render(
      <LikertResponse options={FIVE_OPTIONS} selectedValue={3} onSelect={vi.fn()} />
    )
    const neutral = screen.getByText('Neutral')
    expect(neutral.getAttribute('aria-pressed')).toBe('true')
    const agree = screen.getByText('Agree')
    expect(agree.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onSelect with the option value on click', () => {
    const onSelect = vi.fn()
    render(<LikertResponse options={FIVE_OPTIONS} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Agree'))
    expect(onSelect).toHaveBeenCalledWith(4)
  })

  it('buttons have min-h-[56px] for adequate tap targets', () => {
    const { container } = render(
      <LikertResponse options={FIVE_OPTIONS} onSelect={vi.fn()} />
    )
    const buttons = container.querySelectorAll('button')
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[56px]')
    })
  })
})
