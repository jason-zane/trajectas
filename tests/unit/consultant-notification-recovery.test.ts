import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  send: vi.fn(), alert: vi.fn(), available: true, claim: true,
  updates: [] as Record<string, unknown>[], filters: [] as unknown[][],
}));
vi.mock('@/lib/reports/recipient-availability', () => ({ isReportRecipientAvailable: async () => mocks.available }));
vi.mock('@/lib/email/provider', () => ({ sendHtmlEmail: mocks.send }));
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.alert }));
vi.mock('@/lib/reports/pdf-access', () => ({ downloadSnapshotPdfBase64: vi.fn() }));
vi.mock('@/lib/dal/brand', () => ({ getEffectiveBrand: async () => ({ name: 'Test brand' }) }));
vi.mock('@/lib/hosts', () => ({ buildSurfaceUrl: () => null, getConfiguredSurfaceUrl: () => 'http://localhost' }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  let payload: Record<string, unknown> | undefined;
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'or', 'order', 'limit', 'maybeSingle']) query[method] = (...args: unknown[]) => { mocks.filters.push([method, ...args]); return query; };
  query.update = (value: Record<string, unknown>) => { payload = value; mocks.updates.push(value); return query; };
  query.then = (resolve: (result: unknown) => unknown) => {
    const data = payload ? (mocks.claim ? [{ id: 'snapshot' }] : []) : table === 'report_snapshots' ? { id: 'snapshot', status: 'released', campaign_id: 'campaign', participant_session_id: 'session', consultant_notified_at: null, participant_sessions: { campaign_participant_id: 'participant' }, report_templates: { name: 'Report' } } : table === 'campaigns' ? { consultant_notification_enabled: true, consultant_emails: ['coach@example.invalid'], consultant_notification_include_summary: false, consultant_notification_attach_pdf: false } : table === 'participant_sessions' ? { campaign_participants: { first_name: 'Participant' }, assessments: { title: 'Assessment' } } : [];
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return query;
} }) }));
import { notifyConsultantsForSnapshot } from '@/lib/notifications/consultant-notification';

beforeEach(() => { mocks.available = true; mocks.claim = true; mocks.updates = []; mocks.filters = []; mocks.send.mockResolvedValue({ id: 'provider-accepted' }); });
describe('consultant notification recovery', () => {
  it('records sent only after provider acceptance and gives retries a stable provider key', async () => {
    mocks.send.mockImplementation(async () => { expect(mocks.updates.every(row => row.consultant_notified_at == null)).toBe(true); return { id: 'accepted' }; });
    await notifyConsultantsForSnapshot('snapshot');
    expect(mocks.updates[0]).toHaveProperty('consultant_notification_claimed_at');
    expect(mocks.filters.some(filter => filter[0] === 'or' && String(filter[1]).includes('consultant_notification_claimed_at.lt.'))).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'consultant-report-snapshot' }));
    expect(mocks.updates.at(-1)).toMatchObject({ consultant_notified_at: expect.any(String), consultant_notification_claimed_at: null });
  });
  it('releases failed leases without recording delivery', async () => {
    mocks.send.mockRejectedValue(new Error('provider unavailable'));
    await notifyConsultantsForSnapshot('snapshot');
    expect(mocks.updates.at(-1)).toEqual({ consultant_notification_claimed_at: null });
    expect(mocks.updates.some(row => row.consultant_notified_at)).toBe(false);
    expect(mocks.alert).toHaveBeenCalled();
  });
  it('does not send a revoked report or duplicate an active lease', async () => {
    mocks.available = false;
    await notifyConsultantsForSnapshot('snapshot');
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.updates).toHaveLength(0);
    mocks.available = true; mocks.claim = false;
    await notifyConsultantsForSnapshot('snapshot');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
