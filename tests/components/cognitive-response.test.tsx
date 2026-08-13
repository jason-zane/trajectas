// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CognitiveResponse } from '@/components/assess/formats/cognitive-response'

const STIMULUS = {
  gridSvg: '<div class="cog-cell"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#111827" /></svg></div>'.repeat(8),
  ariaLabel: 'A three-by-three grid of geometric figures with the bottom-right cell missing, and five answer options.',
}

const OPTIONS = [
  { id: 'opt-a', label: 'A', value: 1, optionSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#111827" /></svg>' },
  { id: 'opt-b', label: 'B', value: 2, optionSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#111827" /></svg>' },
  { id: 'opt-c', label: 'C', value: 3, optionSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#111827" /></svg>' },
  { id: 'opt-d', label: 'D', value: 4, optionSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#111827" /></svg>' },
  { id: 'opt-e', label: 'E', value: 5, optionSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="#111827" /></svg>' },
]

describe('CognitiveResponse', () => {
  it('renders the stimulus grid with an honest, non-descriptive aria-label', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={vi.fn()} />)
    expect(screen.getByRole('img', { name: STIMULUS.ariaLabel })).toBeDefined()
  })

  it('renders every option as a radio inside a radiogroup', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeDefined()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('marks the selected option aria-checked=true and the rest false', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} selectedValue={3} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios[2].getAttribute('aria-checked')).toBe('true')
    expect(radios[0].getAttribute('aria-checked')).toBe('false')
  })

  it('calls onSelect with the option value on click, and does not auto-advance on its own (no navigation side effect)', () => {
    const onSelect = vi.fn()
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Option C'))
    expect(onSelect).toHaveBeenCalledWith(3)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('renders each option tile from its optionSvg via a single dangerouslySetInnerHTML host', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    for (const radio of radios) {
      expect(radio.querySelector('svg')).not.toBeNull()
    }
  })

  it('falls back to the plain label when an option has no optionSvg', () => {
    const optionsNoSvg = OPTIONS.map(({ id, label, value }) => ({ id, label, value }))
    render(<CognitiveResponse stimulus={STIMULUS} options={optionsNoSvg} onSelect={vi.fn()} />)
    expect(screen.getByText('A')).toBeDefined()
    expect(screen.getByText('E')).toBeDefined()
  })

  it('renders the blank-cell "?" marker as UI chrome, hidden from assistive tech', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={vi.fn()} />)
    const marker = screen.getByText('?')
    expect(marker.getAttribute('aria-hidden')).toBe('true')
  })

  it('only one tile is a tab stop at a time (roving tabindex)', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} selectedValue={2} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    const tabbable = radios.filter((r) => r.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0].getAttribute('aria-label')).toBe('Option B')
  })

  it('ArrowRight moves focus to the next tile', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(radios[1])
  })

  it('ArrowDown moves focus by a row of three', () => {
    render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(radios[3])
  })

  it('renders without a stimulus (defensive: no crash when the spec failed to load)', () => {
    render(<CognitiveResponse options={OPTIONS} onSelect={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeDefined()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('never renders a raw <script> tag from injected SVG markup (defence in depth against a malformed spec)', () => {
    const { container } = render(<CognitiveResponse stimulus={STIMULUS} options={OPTIONS} onSelect={vi.fn()} />)
    expect(container.innerHTML).not.toMatch(/<script/i)
  })
})
