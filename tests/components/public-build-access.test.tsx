// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VerifyStep } from '@/app/(marketing)/build/verify-step'
const request = vi.hoisted(() => vi.fn())
vi.mock('@/app/actions/public-build-access', () => ({ requestBuildAccess: request }))
vi.mock('@/app/actions/public-builds', () => ({ requestCode: vi.fn(), verifyCode: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
function openRequest() {
  render(<VerifyStep inviteRequired onVerified={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.com' } })
  expect(screen.getByRole('link', { name: 'talk to us' })).toHaveAttribute('href', '/contact')
  fireEvent.click(screen.getByRole('button', { name: 'Request access' }))
}
it('requests access without requiring an invitation code and preserves the email on return', async () => {
  request.mockResolvedValue({ success: true, confirmationSent: true })
  openRequest()
  expect(screen.queryByLabelText('Invitation code')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Email address')).toHaveValue('person@example.com')
  fireEvent.submit(screen.getByRole('button', { name: 'Request invitation' }).closest('form')!)
  expect(await screen.findByRole('status')).toHaveTextContent('sent a confirmation')
  expect(request).toHaveBeenCalledWith({ email: 'person@example.com' })
  fireEvent.click(screen.getByRole('button', { name: 'I have an invitation code' }))
  expect(screen.getByLabelText('Invitation code')).toBeRequired()
  expect(screen.getByLabelText('Email address')).toHaveValue('person@example.com')
})
it('keeps the email when sending fails', async () => {
  request.mockResolvedValue({ error: 'Please try again.' })
  openRequest()
  fireEvent.submit(screen.getByRole('button', { name: 'Request invitation' }).closest('form')!)
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again.')
  expect(screen.getByLabelText('Email address')).toHaveValue('person@example.com')
})
it('does not suggest resubmission when only confirmation failed', async () => {
  request.mockResolvedValue({ success: true, confirmationSent: false })
  openRequest()
  fireEvent.submit(screen.getByRole('button', { name: 'Request invitation' }).closest('form')!)
  expect(await screen.findByRole('status')).toHaveTextContent('don’t need to submit again')
})
