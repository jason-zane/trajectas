// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
const mocks = vi.hoisted(() => ({ demographics: vi.fn(), submit: vi.fn(), push: vi.fn(), clear: vi.fn() }));
vi.mock('@/app/actions/experience', () => ({ saveDemographics: mocks.demographics }));
vi.mock('@/app/actions/assess', () => ({ submitSession: mocks.submit }));
vi.mock('@/lib/assess/response-store', () => ({ clearSession: mocks.clear }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn(), back: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
import { DemographicsForm } from '@/components/assess/demographics-form';
import { ReviewScreen } from '@/components/assess/review-screen';
import { DEFAULT_PAGE_CONTENT } from '@/lib/experience/defaults';
beforeEach(() => { mocks.clear.mockResolvedValue(undefined); });
describe('demographic acknowledgement and timed review', () => {
  it.each(['returned', 'thrown'])('keeps existing values and permits retry after a %s demographic save failure', async kind => {
    if (kind === 'returned') mocks.demographics.mockResolvedValue({ error: 'Unable to save' }); else mocks.demographics.mockRejectedValue(new Error('Unable to save'));
    render(<DemographicsForm token="token" participantId="participant" fields={[{ key: 'department', label: 'Department', type: 'text', enabled: true, required: false }]} initialValues={{ department: 'Operations' }} content={DEFAULT_PAGE_CONTENT.demographics} nextUrl="/next" />);
    expect(screen.getByDisplayValue('Operations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mocks.push).not.toHaveBeenCalled();
    mocks.demographics.mockResolvedValue({});
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/next'));
    expect(mocks.demographics).toHaveBeenLastCalledWith('token', 'participant', { department: 'Operations' }, false);
  });
  it('allows server-confirmed expiry gaps and advances to the next assessment after acknowledged submit', async () => {
    const sections = [{ id: 'section', title: 'Timed section', items: [{ id: 'unanswered' }] }] as ComponentProps<typeof ReviewScreen>['sections'];
    mocks.submit.mockResolvedValue({ ok: true, outcome: 'completed', refreshedAccessToken: 'new-token' });
    render(<ReviewScreen token="old-token" sessionId="session" sections={sections} responses={{}} completeness={{ expected: 0, answered: 0, expiredSectionIds: ['section'] }} content={DEFAULT_PAGE_CONTENT.review} nextUrl="/assess/old-token/assessment-intro/1" />);
    expect(screen.getByText(/time ended/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Submit assessment' }); expect(button).toBeEnabled(); fireEvent.click(button);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/assess/new-token/assessment-intro/1'));
    expect(mocks.clear).toHaveBeenCalledWith('session');
  });
});
