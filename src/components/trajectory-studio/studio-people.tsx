'use client'

import { useState, type CSSProperties } from 'react'
import { Check, ChevronDown, Plus, Search, Users } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { historySessions, initials, snapshotSession, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { SERIES_COLORS } from './studio-chart'
import { Button } from '@/components/ui/button'
import styles from './studio.module.css'

export function StudioPeople({ dataset, settings, single, onChange, onBrowse }: {
  dataset: StudioDataset; settings: StudioSettings; single: boolean;
  onChange: (patch: Partial<StudioSettings>) => void; onBrowse?: () => void;
}) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const options = dataset.result.people.filter((person) => {
    const details = dataset.context?.[person.personKey]
    const matchesSearch = `${person.displayName} ${person.email} ${details?.role ?? ''}`.toLowerCase().includes(query.toLowerCase())
    return matchesSearch
  })
  function toggle(key: string) {
    if (single) { onChange({ people: [key] }); return }
    onChange({ people: settings.people.includes(key) ? settings.people.filter((p) => p !== key) : [...settings.people, key] })
  }
  return <aside className={styles.peoplePanel} aria-label="People selection">
    <button className={styles.peopleHeading} onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}><span><Users size={16} />{single ? 'Find a person' : 'Build your comparison'}</span><ChevronDown size={16} className={collapsed ? styles.rotated : ''} /></button>
    {!collapsed && <div className={styles.peopleBody}>
      <div className={styles.search}><Search size={15} /><input type="search" aria-label="Search people" placeholder="Find a name or role…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <div className={styles.selectionCount}><span>{single ? 'SELECT ONE PERSON' : `${settings.people.length} OF 8 SELECTED`}</span>{!single && settings.people.length > 0 && <button onClick={() => onChange({ people: [] })}>Clear</button>}</div>
      <div className={styles.peopleList}>
        {options.map((person) => {
          const selected = settings.people.includes(person.personKey)
          const color = SERIES_COLORS[dataset.result.people.findIndex((p) => p.personKey === person.personKey) % SERIES_COLORS.length]
          const details = dataset.context?.[person.personKey]
          const session = snapshotSession(dataset.result, person.personKey, settings)
          const history = historySessions(dataset.result, person.personKey, settings)
          return <button key={person.personKey} className={`${styles.personOption} ${selected ? styles.personSelected : ''}`} aria-pressed={selected} disabled={!single && !selected && settings.people.length >= 8} onClick={() => toggle(person.personKey)}>
            <span className={styles.avatar} style={{ '--person-color': color } as CSSProperties}>{initials(person.displayName)}</span>
            <span className={styles.personText}><strong>{person.displayName}</strong><span>{details?.role ?? person.email}</span><small>{settings.lens === 'time' ? `${history.length} completed result${history.length === 1 ? '' : 's'}` : session?.campaignTitle ?? 'No snapshot result selected'}</small></span>
            <span className={`${styles.checkBox} ${single ? styles.radioBox : ''}`} aria-hidden="true">{selected && <Check size={12} />}</span>
          </button>
        })}
        {!options.length && <EmptyState size="sm" title="No people found" description="Try another name or role." />}
      </div>
      {onBrowse && <Button variant="ghost" className="w-full h-auto min-h-9 whitespace-normal text-left" onClick={onBrowse}><Plus size={15} />Browse workspace participants</Button>}
      <p className={styles.peopleFootnote}>Linked campaign records are grouped into one person. Selected people stay selected when you filter the list.</p>
    </div>}
  </aside>
}
