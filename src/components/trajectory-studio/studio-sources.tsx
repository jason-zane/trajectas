'use client'

import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { campaignOptions, displayDate, selectCampaign, snapshotKey, snapshotSession, uniqueSessions, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import styles from './studio.module.css'

export function StudioSources({ dataset, settings, open, onOpenChange, onChange }: {
  dataset: StudioDataset; settings: StudioSettings; open: boolean; onOpenChange: (open: boolean) => void; onChange: (patch: Partial<StudioSettings>) => void;
}) {
  const result = dataset.result
  const campaigns = campaignOptions(result, settings.assessment)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`${styles.dialog} sm:max-w-2xl max-h-[85dvh] overflow-y-auto`}><DialogHeader><DialogTitle>Choose the results to compare</DialogTitle><DialogDescription>One completed result per person, from a campaign. These selections stay fixed when you explore their history.</DialogDescription></DialogHeader>
    <label className={styles.field}><span>Use a campaign for everyone</span><select aria-label="Use campaign for everyone" value="" onChange={(e) => onChange({ snapshotSelections: selectCampaign(result, settings, e.target.value) })}><option value="" disabled>Choose a campaign…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <p className={styles.finePrint}>People without a completed result in that campaign will be left empty. You can choose a different campaign or attempt for each person below.</p>
    <div className={styles.sourceRows}>{settings.people.map((key) => {
      const person = result.people.find((p) => p.personKey === key)
      const sessions = uniqueSessions(result, key).filter((p) => p.assessmentId === settings.assessment)
      const current = snapshotSession(result, key, settings)
      const options = [...new Map(sessions.map((p) => [p.campaignId, p.campaignTitle])).entries()]
      return <div key={key} className={styles.sourceRow}><strong>{person?.displayName}</strong><div>
        <label className={styles.field}><span>Campaign</span><select aria-label={`Campaign for ${person?.displayName}`} value={current?.campaignId ?? ''} onChange={(e) => onChange({ snapshotSelections: e.target.value ? selectCampaign(result, settings, e.target.value, key) : { ...settings.snapshotSelections, [snapshotKey(key, settings.assessment)]: null } })}><option value="">No result selected</option>{options.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label className={styles.field}><span>Completed result</span><select aria-label={`Result for ${person?.displayName}`} disabled={!current} value={current?.sessionId ?? ''} onChange={(e) => onChange({ snapshotSelections: { ...settings.snapshotSelections, [snapshotKey(key, settings.assessment)]: e.target.value || null } })}>{!current && <option value="">No completed result</option>}{sessions.filter((s) => s.campaignId === current?.campaignId).reverse().map((p, i) => <option key={p.sessionId} value={p.sessionId}>{displayDate(p.completedAt)} · attempt {p.attemptNumber}{i === 0 ? ' · latest' : ''}</option>)}</select></label>
      </div></div>
    })}</div>
    <button className={styles.primaryButton} onClick={() => onOpenChange(false)}>Done<Check size={15} /></button>
  </DialogContent></Dialog>
}
