'use client'

import { useState, type CSSProperties } from 'react'
import { Check, ChevronDown, Plus, Search, Users } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { campaignOptions, initials, snapshotSession, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { SERIES_COLORS } from './studio-chart'
import styles from './studio.module.css'

export function StudioPeople({ dataset, settings, single, onChange, onBrowse }: {
  dataset: StudioDataset; settings: StudioSettings; single: boolean;
  onChange: (patch: Partial<StudioSettings>) => void; onBrowse?: () => void;
}) {
  const [query, setQuery] = useState('')
  const [population, setPopulation] = useState('all')
  const [collapsed, setCollapsed] = useState(false)
  const campaigns = campaignOptions(dataset.result)
  const options = dataset.result.people.filter((person) => {
    const details = dataset.context?.[person.personKey]
    const matchesSearch = `${person.displayName} ${person.email} ${details?.role ?? ''}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch && (population === 'all' || details?.population === population)
  })
  function toggle(key: string) {
    if (single) { onChange({ people: [key] }); return }
    onChange({ people: settings.people.includes(key) ? settings.people.filter((p) => p !== key) : [...settings.people, key] })
  }
  return <aside className={styles.peoplePanel} aria-label="People and campaigns">
    <button className={styles.peopleHeading} onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}><span><Users size={16} />{single ? 'Find a person' : 'Build your comparison'}</span><ChevronDown size={16} className={collapsed ? styles.rotated : ''} /></button>
    {!collapsed && <div className={styles.peopleBody}>
      <label className={styles.field}><span>Campaign scope</span><select aria-label="Campaign scope" value={settings.campaign} onChange={(e) => onChange({ campaign: e.target.value })}><option value="all">All linked campaigns</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {!!dataset.context && <label className={styles.field}><span>People</span><select aria-label="People type" value={population} onChange={(e) => setPopulation(e.target.value)}><option value="all">Employees & candidates</option><option value="Employee">Employees</option><option value="Candidate">Candidates</option></select></label>}
      <div className={styles.search}><Search size={15} /><input type="search" aria-label="Search people" placeholder="Find a name or role…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <div className={styles.selectionCount}><span>{single ? 'SELECT ONE PERSON' : `${settings.people.length} OF 8 SELECTED`}</span>{!single && settings.people.length > 0 && <button onClick={() => onChange({ people: [] })}>Clear</button>}</div>
      <div className={styles.peopleList}>
        {options.map((person) => {
          const selected = settings.people.includes(person.personKey)
          const color = SERIES_COLORS[dataset.result.people.findIndex((p) => p.personKey === person.personKey) % SERIES_COLORS.length]
          const details = dataset.context?.[person.personKey]
          const session = snapshotSession(dataset.result, person.personKey, settings)
          return <button key={person.personKey} className={`${styles.personOption} ${selected ? styles.personSelected : ''}`} aria-pressed={selected} disabled={!single && !selected && settings.people.length >= 8} onClick={() => toggle(person.personKey)}>
            <span className={styles.avatar} style={{ '--person-color': color } as CSSProperties}>{initials(person.displayName)}</span>
            <span className={styles.personText}><strong>{person.displayName}</strong><span>{details?.role ?? person.email}</span><small>{session ? `${session.assessmentName} · ${session.attemptNumber > 1 ? 'Repeat assessment' : 'One assessment'}` : 'No result in this scope'}</small></span>
            <span className={`${styles.checkBox} ${single ? styles.radioBox : ''}`} aria-hidden="true">{selected && <Check size={12} />}</span>
          </button>
        })}
        {!options.length && <EmptyState size="sm" title="No people found" description="Try another name or people filter." />}
      </div>
      {onBrowse && <button className={styles.addPeople} onClick={onBrowse}><Plus size={15} />Browse workspace participants</button>}
      <p className={styles.peopleFootnote}>Linked campaign records are grouped into one person. Selected people stay selected when you filter the list.</p>
    </div>}
  </aside>
}
