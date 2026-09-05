'use client'

import { useCallback, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronRight, CircleHelp, Download, GitCompareArrows, Layers, LayoutGrid, LineChart, Moon, Settings2, Sun, Table2, TrendingUp, UserRound, Users, X } from 'lucide-react'
import { ThemeProvider as StudioThemeProvider, useTheme } from 'next-themes'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OVERALL_ID, type CanvasPoint } from '@/lib/canvas/types'
import { assessmentOptions, campaignOptions, changeFor, displayDate, initialSettings, initials, measures, scopedPoints, score, signed, snapshotPoint, snapshotSession, uniqueSessions, validateSavedSettings, type Experience, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { SERIES_COLORS, StudioChart, type ChartLine } from './studio-chart'
import { StudioPeople } from './studio-people'
import { StudioTable } from './studio-table'
import { StudioExport } from './studio-report'
import styles from './studio.module.css'

const experiences = [
  { id: 'compare' as const, number: '01', name: 'Compare', caption: 'People, side by side', icon: GitCompareArrows },
  { id: 'individual' as const, number: '02', name: 'Individual trajectory', caption: 'One person, over time', icon: UserRound },
  { id: 'unified' as const, number: '03', name: 'Unified trajectory', caption: 'Both, in one workspace', icon: Layers },
]
type SavedView = { name: string; experience: Experience; settings: StudioSettings }

type StudioProps = { dataset: StudioDataset; initialExperience?: Experience; onBrowse?: () => void; nonce?: string }

export function TrajectoryStudio(props: StudioProps) {
  return <StudioThemeProvider nonce={props.nonce} attribute="data-studio-theme" defaultTheme="light" enableSystem={false} enableColorScheme={false} storageKey="trajectas-studio-theme"><StudioWorkspace {...props} /></StudioThemeProvider>
}

function StudioWorkspace({ dataset, initialExperience = 'compare', onBrowse }: StudioProps) {
  const [experience, setExperience] = useState<Experience>(initialExperience)
  const [views, setViews] = useState<Record<Experience, StudioSettings>>(() => Object.fromEntries(experiences.map((e) => {
    const initial = initialSettings(dataset.result, e.id)
    if (!dataset.demo && e.id !== 'individual') initial.people = dataset.result.people.map((p) => p.personKey)
    return [e.id, initial]
  })) as Record<Experience, StudioSettings>)
  const [exportOpen, setExportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [saved, setSaved] = useState<SavedView[]>([])
  const [sessionDetail, setSessionDetail] = useState<{ point: CanvasPoint; person: string; measure?: string } | null>(null)
  const [openDimension, setOpenDimension] = useState<string | null>(null)
  const { resolvedTheme, setTheme } = useTheme()
  const settings = views[experience]
  const single = experience === 'individual'
  const time = settings.lens === 'time'
  const result = dataset.result
  const selected = result.people.filter((person) => settings.people.includes(person.personKey))
  const allMeasures = measures(result, settings)
  const metric = allMeasures.find((m) => m.id === settings.metric) ?? allMeasures[0]
  const assessments = assessmentOptions(result)
  const assessment = assessments.find((a) => a.id === settings.assessment)
  const dimensions = allMeasures.filter((m) => m.level === 'dimension' || m.level === 'overall')
  const profileRows = metric?.level === 'factor' ? allMeasures.filter((m) => m.parentId === metric.parentId) : metric?.level === 'dimension' && allMeasures.some((m) => m.parentId === metric.id) ? allMeasures.filter((m) => m.id === metric.id || m.parentId === metric.id) : dimensions
  const colorFor = (key: string) => SERIES_COLORS[Math.max(0, result.people.findIndex((p) => p.personKey === key)) % SERIES_COLORS.length]
  const currentPoints = selected.map((person) => ({ person, point: snapshotPoint(result, person.personKey, settings.metric, settings) }))
  const scored = currentPoints.filter((row): row is typeof row & { point: CanvasPoint } => row.point !== null)
  const latestScores = scored.map((row) => row.point.value)
  const totalSessions = selected.reduce((total, person) => total + uniqueSessions(result, person.personKey).filter((p) => (settings.representation === 'table' && settings.includeAllAssessments || p.assessmentId === settings.assessment) && (settings.campaign === 'all' || p.campaignId === settings.campaign) && (!settings.from || p.completedAt.slice(0, 10) >= settings.from) && (!settings.to || p.completedAt.slice(0, 10) <= settings.to)).length, 0)
  const firstPerson = selected[0]
  const ownPoints = firstPerson ? scopedPoints(result, firstPerson.personKey, settings.metric, settings) : []
  const ownChange = changeFor(ownPoints)
  const lines: ChartLine[] = selected.map((person) => ({ id: person.personKey, label: person.displayName, color: colorFor(person.personKey), points: scopedPoints(result, person.personKey, settings.metric, settings) }))
  const validRange = !settings.from || !settings.to || settings.from <= settings.to
  const hasData = time ? lines.some((line) => line.points.length > 0) : scored.length > 0
  const repeatCount = lines.filter((line) => line.points.length > 1).length
  const sourceLabel = dataset.demo ? 'Illustrative data' : 'Workspace data'
  const title = experience === 'compare' ? 'Compare' : 'Trajectory'
  const reportTitle = single && firstPerson ? `${firstPerson.displayName} · Trajectory` : time ? 'Trajectory · Progress report' : 'Trajectory · Comparison report'
  const storageKey = `trajectas-studio-v1-${dataset.demo ? 'demo' : result.clientId ?? 'workspace'}`

  const update = useCallback((patch: Partial<StudioSettings>) => {
    setViews((previous) => {
      const next = { ...previous[experience], ...patch }
      if (patch.assessment) {
        const available = measures(result, next)
        if (!available.some((m) => m.id === next.metric)) next.metric = available[0]?.id ?? OVERALL_ID
      }
      return { ...previous, [experience]: next }
    })
  }, [experience, result])

  const chooseMetric = useCallback((id: string) => { update({ metric: id }); }, [update])

  function switchExperience(next: Experience) {
    setExperience(next); setOpenDimension(null)
    const url = new URL(window.location.href)
    url.searchParams.set('experience', next)
    window.history.replaceState(null, '', url)
  }

  function openSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as unknown
      const entries = Array.isArray(raw) ? raw : []
      setSaved(entries.filter((entry): entry is SavedView => !!entry && typeof entry === 'object' && typeof entry.name === 'string' && experiences.some((e) => e.id === entry.experience) && !!validateSavedSettings(entry.settings, result)).slice(0, 12))
    } catch { toast.error('Saved views could not be read on this device.') }
    setViewName(`${single && firstPerson ? firstPerson.displayName : 'Leadership'} · ${time ? 'Progress' : 'Comparison'}`)
    setSaveOpen(true)
  }

  function saveView() {
    const name = viewName.trim()
    if (!name) return
    const next = [{ name, experience, settings }, ...saved.filter((s) => s.name !== name)].slice(0, 12)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); toast.success('View saved on this device'); setSaveOpen(false) }
    catch { toast.error('This browser could not save the view. Check its storage settings.') }
  }

  function deleteView(index: number) {
    const next = saved.filter((_, i) => i !== index)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); toast.success('Saved view removed') }
    catch { toast.error('The view could not be removed.') }
  }

  const personDateText = selected.map((person) => {
    const session = snapshotSession(result, person.personKey, settings)
    return { person, session }
  })

  return <div className={`${styles.studio} ${dataset.demo ? styles.withRail : ''}`}>
    <a href="#studio-main" className={styles.skipLink}>Skip to results</a>
    {dataset.demo && <aside className={styles.reviewRail}>
      <Image src="/brand/span-lockup-horizontal-light.svg" alt="Trajectas" width={151} height={40} className={styles.brand} priority />
      <div className={styles.railWorkspace}><span className={styles.workspaceInitial}>N</span><div><strong>{dataset.workspaceName}</strong><span>Design workspace</span></div></div>
      <p className={styles.railLabel}>THREE WAYS TO SEE MORE</p>
      <nav aria-label="Design experiences">{experiences.map(({ id, number, name, caption, icon: Icon }) => <button key={id} className={experience === id ? styles.railActive : ''} onClick={() => switchExperience(id)} aria-current={experience === id ? 'page' : undefined}><span className={styles.railNavTitle}><Icon size={18} /><strong>{name}</strong></span><span className={styles.railNavCaption}>{caption}</span><span className={styles.railNumber}>{number}</span></button>)}</nav>
      <div className={styles.railNote}><span>THE EXPLORATION</span><p>Different perspectives.<br />One clearer picture.</p><small>Explore each experience, then choose how you want to bring them together.</small></div>
      <button className={styles.railHelp} onClick={() => setHelpOpen(true)}><CircleHelp size={17} />How to read the results</button>
    </aside>}
    <div className={styles.mainShell}>
      <div className={styles.reviewBar}><span><span className={styles.liveDot} />{dataset.demo ? 'INTERACTIVE DESIGN REVIEW' : 'TRAJECTORY STUDIO'}</span><span>{experiences.find((e) => e.id === experience)?.number} / 03 <i />{sourceLabel}<button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Toggle colour theme">{resolvedTheme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}</button></span></div>
      {!dataset.demo && <nav className={styles.inlineExperiences} aria-label="Design experiences">{experiences.map((e) => <button key={e.id} aria-pressed={experience === e.id} onClick={() => switchExperience(e.id)}>{e.number} {e.name}</button>)}</nav>}
      <main id="studio-main" className={styles.main}>
        <header className={styles.header}><PageHeader title={title} eyebrow={experience === 'unified' ? 'Insights / One workspace, every perspective' : single ? 'Insights / Individual growth' : 'Insights / People in perspective'} description={single ? 'Understand the journey. See what is changing.' : experience === 'unified' ? 'See people at a moment in time, or follow how they change.' : 'Bring people together. Understand what sets them apart.'} /><div className={styles.headerActions}><button className={styles.secondaryButton} onClick={openSaved}><Bookmark size={15} />Saved views</button><button className={styles.primaryButton} onClick={() => setExportOpen(true)} disabled={!totalSessions || !selected.length || !validRange}><Download size={15} />Export</button></div></header>
        <div className={styles.workspace}>
          <StudioPeople dataset={dataset} settings={settings} single={single} onChange={update} onBrowse={onBrowse} />
          <div className={styles.results}>
            <section className={styles.contextBar} aria-label="Assessment and view settings">
              <label className={styles.assessmentSelect}><span><Layers size={14} />ASSESSMENT</span><select aria-label="Assessment" value={settings.assessment} onChange={(e) => { update({ assessment: e.target.value }); setOpenDimension(null) }}>{!assessments.length && <option value="">Select people to see assessments</option>}{assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              {experience === 'unified' ? <div className={styles.lensToggle} aria-label="Analysis view"><button aria-pressed={!time} onClick={() => update({ lens: 'snapshot' })}><Users size={15} />Snapshot</button><button aria-pressed={time} onClick={() => update({ lens: 'time' })}><TrendingUp size={15} />Over time</button></div> : <div className={styles.windowCaption}><span>{time ? 'OBSERVATION WINDOW' : 'SNAPSHOT WINDOW'}</span><strong>{displayDate(settings.from)} – {displayDate(settings.to)}</strong></div>}
              <button className={styles.settingsButton} aria-label="Configure dates and display" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /><span>Settings</span></button>
            </section>
            <div className={styles.selectionStrip}>
              <div className={styles.selectedChips}>{selected.map((person) => <span key={person.personKey} className={styles.personChip} style={{ '--person-color': colorFor(person.personKey) } as CSSProperties}><i />{person.displayName}{!single && <button aria-label={`Remove ${person.displayName}`} onClick={() => update({ people: settings.people.filter((p) => p !== person.personKey) })}><X size={12} /></button>}</span>)}{!selected.length && <span className={styles.selectHint}>Choose {single ? 'a person' : 'people'} to begin</span>}</div><span className={styles.sourceTag}><Check size={12} />Completed results only</span>
            </div>
            {!validRange && <Alert variant="warning"><AlertTitle>Check the date window</AlertTitle><AlertDescription>The start date must be on or before the end date. Open Settings to adjust it.</AlertDescription></Alert>}
            {!selected.length ? <div className={styles.emptyPanel}><EmptyState eyebrow={single ? 'Every journey starts somewhere' : 'A clearer view starts with people'} title={single ? 'Whose trajectory would you like to explore?' : 'Choose people to build your comparison'} description="Use the people panel to select participants, then choose an assessment and date window." />{onBrowse && <button className={styles.primaryButton} onClick={onBrowse}>Browse workspace participants<ArrowRight size={16} /></button>}</div> : <>
              {single && firstPerson && <div className={styles.personHero}><span className={styles.heroAvatar} style={{ '--person-color': colorFor(firstPerson.personKey) } as CSSProperties}>{initials(firstPerson.displayName)}</span><div><p>INDIVIDUAL TRAJECTORY</p><h2>{firstPerson.displayName}</h2><span>{dataset.context?.[firstPerson.personKey]?.role ?? firstPerson.email}</span></div><div className={styles.heroSessionCount}><strong>{totalSessions}</strong><span>completed assessments</span></div></div>}
              <section className={styles.insightStrip} aria-label="Result summary">
                <div><span>{single ? 'LATEST SCORE' : 'PEOPLE IN VIEW'}</span><strong>{single ? score(scored[0]?.point.value) : selected.length}<small>{single ? '/ 100' : ` / ${result.people.length}`}</small></strong><p>{single ? metric?.name : `${scored.length} with a current ${metric?.name.toLowerCase() ?? 'score'} result`}</p></div>
                <div><span>{time ? 'OBSERVED CHANGE' : 'SCORE RANGE'}</span><strong>{time && single ? signed(ownChange) : time ? repeatCount : latestScores.length ? `${score(Math.min(...latestScores))}–${score(Math.max(...latestScores))}` : '—'}<small>{time ? single ? 'pts' : 'people' : '/ 100'}</small></strong><p>{time ? single ? `From ${displayDate(ownPoints[0]?.completedAt)}` : 'With repeat results on this measure' : metric?.name ?? 'Selected measure'}</p></div>
                <div><span>{time ? 'ASSESSMENT HISTORY' : 'ATTEMPT RULE'}</span><strong className={styles.textStatistic}>{time ? `${totalSessions} completed` : 'Latest in window'}</strong><p>{time ? `${displayDate(settings.from)} – ${displayDate(settings.to)}` : `Through ${displayDate(settings.to)}`}</p></div>
              </section>
              <section className={styles.chartPanel} aria-label={time ? 'Progress chart' : 'Comparison profile'}>
                <div className={styles.chartHeader}><div><p className={styles.overline}>{time ? 'THE JOURNEY' : 'SIDE BY SIDE'}</p><h2>{time ? `${metric?.name ?? 'Score'} over time` : 'Different people. A shared perspective.'}</h2><p>{time ? 'Follow completed assessments on the dates they happened.' : 'Compare the same assessment, one dimension at a time.'}</p></div><div className={styles.chartViewToggle}><button aria-label="Show chart" aria-pressed={settings.representation === 'chart'} onClick={() => update({ representation: 'chart' })}>{time ? <LineChart size={16} /> : <LayoutGrid size={16} />}</button><button aria-label="Show score matrix" aria-pressed={settings.representation === 'table'} onClick={() => update({ representation: 'table' })}><Table2 size={16} /></button></div></div>
                <div className={styles.chartTools}><label>Focus<select aria-label="Focus measure" value={metric?.id ?? ''} onChange={(e) => chooseMetric(e.target.value)}>{allMeasures.map((m) => <option key={m.id} value={m.id}>{m.level === 'factor' ? '↳ ' : ''}{m.name}</option>)}</select></label><button onClick={() => setHelpOpen(true)}><CircleHelp size={14} />How to read this</button></div>
                {(!hasData && !(settings.representation === 'table' && settings.includeAllAssessments && totalSessions > 0)) || !validRange ? <EmptyState size="sm" title="No results in this scope" description="Try another assessment, include more campaigns, or widen the date window. Missing scores are never shown as zero." /> : settings.representation === 'table' ? <>
                  {assessments.length > 1 && <label className={`${styles.checkLabel} ${styles.matrixScope}`}><input type="checkbox" checked={settings.includeAllAssessments} onChange={(e) => update({ includeAllAssessments: e.target.checked })} /><span><strong>Compare across all {assessments.length} assessments</strong><small>Each instrument keeps its own scores and measures.</small></span></label>}
                  {(settings.includeAllAssessments ? assessments : assessment ? [assessment] : []).map((a) => <section key={a.id}>{settings.includeAllAssessments && <h3 className={styles.matrixTitle}>{a.name}</h3>}<StudioTable dataset={dataset} settings={{ ...settings, assessment: a.id }} onMeasure={(id) => update({ assessment: a.id, metric: id })} /></section>)}
                </> : time ? <>
                  <div className={styles.chartLegend}>{lines.map((line) => <span key={line.id}><i style={{ background: line.color }} /><strong>{line.label}</strong><span>{score(line.points.at(-1)?.value)}</span><small>{signed(changeFor(line.points))}</small></span>)}</div>
                  <StudioChart lines={lines} showIntervals={settings.showIntervals} onSession={(point, person) => setSessionDetail({ point, person, measure: metric?.name })} />
                  {repeatCount === 0 && <p className={styles.inlineNote}>Only one measured attempt per person in this window. A second attempt is needed to show change.</p>}
                  {settings.showIntervals && <p className={styles.inlineNote}>{lines.some((line) => line.points.some((p) => p.ciLower !== null && p.ciUpper !== null)) ? 'Vertical whiskers show the stored score intervals where available.' : 'No stored score intervals are available for this measure.'}</p>}
                </> : <div className={styles.profileChart}>
                  <div className={styles.profileAxis}><span>{metric?.level === "factor" ? "FACTOR" : "MEASURE"}</span><div>{[0, 25, 50, 75, 100].map((n) => <span key={n}>{n}</span>)}</div><span>SPREAD</span></div>
                  {profileRows.map((entity) => {
                    const values = selected.map((person) => ({ person, point: snapshotPoint(result, person.personKey, entity.id, settings) }))
                    const numbers = values.flatMap((v) => v.point ? [v.point.value] : [])
                    const focused = settings.metric === entity.id
                    return <div key={entity.id} className={`${styles.profileRow} ${focused ? styles.profileFocused : ''}`}>
                      <button onClick={() => chooseMetric(entity.id)}>{entity.name}<ChevronRight size={13} /></button>
                      <div className={styles.dotTrack} style={{ minHeight: `${Math.max(40, selected.length * 10 + 12)}px` }}>
                        <div className={styles.trackGrid}>{[0, 25, 50, 75, 100].map((n) => <i key={n} style={{ left: `${n}%` }} />)}</div>
                        {values.map(({ person, point }, index) => point && <button key={person.personKey} className={styles.scoreDot} style={{ left: `${point.value}%`, top: `${10 + index * 10}px`, '--person-color': colorFor(person.personKey) } as CSSProperties} aria-label={`${person.displayName}, ${entity.name}, ${score(point.value)}, ${displayDate(point.completedAt)}`} title={`${person.displayName} · ${score(point.value)} · ${displayDate(point.completedAt)}`} onClick={() => setSessionDetail({ point, person: person.displayName, measure: entity.name })}><span>{score(point.value)}</span></button>)}
                      </div>
                      <span className={styles.spread}>{numbers.length >= 2 ? score(Math.max(...numbers) - Math.min(...numbers)) : '—'}<small>pts</small></span>
                    </div>
                  })}
                  <div className={styles.chartLegend}>{selected.map((person) => <span key={person.personKey}><i style={{ background: colorFor(person.personKey) }} /><strong>{person.displayName}</strong></span>)}</div>
                  <p className={styles.inlineNote}>Each dot is one person’s latest completed result in the selected window. Dates can differ. Spread is the highest minus the lowest observed score.</p>
                </div>}
              </section>
              <div className={styles.lowerGrid}>
                <section className={styles.breakdownPanel}><div className={styles.sectionHeading}><div><p className={styles.overline}>{time ? 'LOOK A LITTLE CLOSER' : 'BEYOND THE OVERALL SCORE'}</p><h2>{time ? 'What is changing?' : 'Explore the detail'}</h2></div><span>{assessment?.name}</span></div>
                  {dimensions.filter((d) => d.level === 'dimension').map((dimension) => {
                    const factorRows = allMeasures.filter((m) => m.parentId === dimension.id)
                    const changes = selected.flatMap((person) => { const value = changeFor(scopedPoints(result, person.personKey, dimension.id, settings)); return value === null ? [] : [{ person, value }] }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                    const own = firstPerson ? scopedPoints(result, firstPerson.personKey, dimension.id, settings) : []
                    const current = firstPerson ? snapshotPoint(result, firstPerson.personKey, dimension.id, settings) : null
                    const summary = time ? single ? `${score(own[0]?.value)} → ${score(own.at(-1)?.value)}` : changes.length ? `${changes[0].person.displayName.split(' ')[0]} ${signed(changes[0].value)} pts` : 'One attempt only' : `${factorRows.length} factors`
                    return <div key={dimension.id}><button className={`${styles.breakdownRow} ${settings.metric === dimension.id ? styles.breakdownSelected : ''}`} aria-expanded={openDimension === dimension.id} onClick={() => { chooseMetric(dimension.id); setOpenDimension(openDimension === dimension.id ? null : dimension.id) }}><span><ChevronRight size={14} className={openDimension === dimension.id ? styles.openArrow : ''} />{dimension.name}</span><span>{summary}{single && time && <strong className={styles.changePill}>{signed(changeFor(own))}</strong>}{!time && single && <strong>{score(current?.value)}</strong>}</span></button>
                      {openDimension === dimension.id && factorRows.map((factor) => <button key={factor.id} className={styles.factorRow} onClick={() => chooseMetric(factor.id)}><span>{factor.name}</span><span>{selected.map((person) => { const point = snapshotPoint(result, person.personKey, factor.id, settings); return <strong key={person.personKey} style={{ color: colorFor(person.personKey) }} title={`${person.displayName}: ${point ? score(point.value) : 'Not measured in the latest attempt'}`}>{score(point?.value)}</strong> })}<ArrowUpRight size={13} /></span></button>)}
                    </div>
                  })}
                </section>
                <section className={styles.contextPanel}><p className={styles.overline}>{single ? 'ASSESSMENT MOMENTS' : 'A FAIR COMPARISON STARTS HERE'}</p><h2>{single ? 'The story so far' : 'Know what you are comparing'}</h2>
                  {single && firstPerson ? <div className={styles.timeline}>{uniqueSessions(result, firstPerson.personKey).filter((p) => p.assessmentId === settings.assessment && (settings.campaign === 'all' || settings.campaign === p.campaignId) && (!settings.from || p.completedAt.slice(0, 10) >= settings.from) && (!settings.to || p.completedAt.slice(0, 10) <= settings.to)).map((session, index) => <button key={session.sessionId} onClick={() => { const measured = scopedPoints(result, firstPerson.personKey, settings.metric, settings).find((p) => p.sessionId === session.sessionId); setSessionDetail({ point: measured ?? session, person: firstPerson.displayName, measure: measured ? metric?.name : undefined }) }}><i /><span><strong>{displayDate(session.completedAt)}</strong><small>{session.campaignTitle}</small><em>{index === 0 ? 'First in this window' : `Attempt ${session.attemptNumber}`}</em></span><ArrowUpRight size={14} /></button>)}</div> : <><div className={styles.contextItem}><Check size={16} /><div><strong>{settings.representation === "table" && settings.includeAllAssessments ? "Separate assessment bases" : "One assessment basis"}</strong><p>{settings.representation === "table" && settings.includeAllAssessments ? "Each instrument keeps its own measures and scores." : `${assessment?.name ?? "Choose an assessment"}. Other instruments stay separate.`}</p></div></div><div className={styles.contextItem}><Check size={16} /><div><strong>One person, one identity</strong><p>History follows linked records across campaigns.</p></div></div><div className={styles.contextItem}><Check size={16} /><div><strong>Actual dates, visible</strong><p>{time ? 'Change starts at each person’s first measured result in this window.' : 'Latest completed attempt inside your selected window.'}</p></div></div><button className={styles.textLink} onClick={() => setHelpOpen(true)}>Review dates & methodology<ArrowRight size={14} /></button></>}
                </section>
              </div>
              <footer className={styles.resultsFooter}><span>{selected.length} people · {totalSessions} completed assessments · {sourceLabel}</span><button onClick={() => setHelpOpen(true)}>Score scale & methodology<ArrowUpRight size={12} /></button></footer>
            </>}
          </div>
        </div>
      </main>
    </div>

    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className={`${styles.dialog} sm:max-w-lg`}><DialogHeader><DialogTitle>Set the comparison context</DialogTitle><DialogDescription>Settings apply immediately to charts, detail, and exports.</DialogDescription></DialogHeader><div className={styles.dateFields}><label className={styles.field}><span>Window start / baseline</span><input type="date" aria-label="Window start" value={settings.from} onChange={(e) => update({ from: e.target.value })} /></label><label className={styles.field}><span>Window end / snapshot cutoff</span><input type="date" aria-label="Window end" value={settings.to} onChange={(e) => update({ to: e.target.value })} /></label></div>{!validRange && <p className={styles.validationError}>The end date must be on or after the start date.</p>}<p className={styles.finePrint}>Snapshot uses each person’s latest completed attempt inside this inclusive window. Over time starts at each person’s first measured result in the window. Dates use UTC.</p><label className={styles.checkLabel}><input type="checkbox" checked={settings.showIntervals} onChange={(e) => update({ showIntervals: e.target.checked })} /><span><strong>Show stored score intervals</strong><small>Where available in Over time. No intervals are invented for rollups.</small></span></label><div className={styles.settingsFact}><Check size={16} /><span>Fixed score scale: <strong>0–100</strong><small>Scores keep the same visual scale across views.</small></span></div><div className={styles.settingsFact}><Layers size={16} /><span>Assessment: <strong>{assessment?.name ?? 'None selected'}</strong><small>Separate assessments are never averaged together.</small></span></div><button className={styles.primaryButton} onClick={() => setSettingsOpen(false)}>Done<Check size={15} /></button></DialogContent></Dialog>

    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className={`${styles.dialog} sm:max-w-xl max-h-[85dvh] overflow-y-auto`}><DialogHeader><DialogTitle>Read the results in context</DialogTitle><DialogDescription>{assessment?.name ?? 'Your assessment'} · {campaignOptions(result).find((c) => c.id === settings.campaign)?.name ?? 'All linked campaigns'}</DialogDescription></DialogHeader><div className={styles.methodology}><p><strong>Scores are scaled from 0 to 100.</strong> These are observed scores, not percentiles or a ranking. A higher preference score is not necessarily better.</p><p><strong>Compare the same instrument.</strong> Each view uses one assessment ID. Selecting another instrument updates its dimensions and factors; scores are not averaged across instruments.</p><p><strong>Change is a difference in points.</strong> It starts at the first available result for each measure in the window. The chart shows actual dates and any observed dips. Change alone does not establish statistical significance or explain its cause.</p><p><strong>Missing is not zero.</strong> Snapshot takes one completed attempt per person. Factors missing from that attempt stay empty, even if an earlier attempt measured them.</p><p><strong>People follow linked records.</strong> The existing person identity links campaign records. Similar names or emails are not automatically merged here.</p><h3>Latest attempts used in this window</h3>{personDateText.map(({ person, session }) => <div className={styles.methodRow} key={person.personKey}><strong>{person.displayName}</strong><span>{displayDate(session?.completedAt)}<small>{session?.campaignTitle ?? 'No eligible completed attempt'}</small></span></div>)}{dataset.demo && <p className={styles.demoNotice}>These people, assessment structures, and results are fictional examples for design review.</p>}</div></DialogContent></Dialog>

    <Dialog open={saveOpen} onOpenChange={setSaveOpen}><DialogContent className={`${styles.dialog} sm:max-w-lg`}><DialogHeader><DialogTitle>Saved views</DialogTitle><DialogDescription>Save selections and settings on this device. Scores are read again from the available dataset when you reopen a view.</DialogDescription></DialogHeader><label className={styles.field}><span>View name</span><input aria-label="View name" maxLength={100} value={viewName} onChange={(e) => setViewName(e.target.value)} /></label><button className={styles.primaryButton} disabled={!viewName.trim()} onClick={saveView}><Bookmark size={15} />Save current view</button>{saved.length > 0 && <div className={styles.savedViews}>{saved.map((entry, index) => <div key={index}><button onClick={() => { const valid = validateSavedSettings(entry.settings, result); if (!valid) { toast.error('This view is no longer available for the current dataset.'); return }; setViews((previous) => ({ ...previous, [entry.experience]: valid })); switchExperience(entry.experience); setSaveOpen(false); toast.success('Saved view opened') }}><Bookmark size={14} /><span><strong>{entry.name}</strong><small>{entry.settings.people.length} people · {entry.settings.lens === 'time' ? 'Over time' : 'Snapshot'}</small></span><ArrowUpRight size={14} /></button><button aria-label={`Delete saved view ${entry.name}`} onClick={() => deleteView(index)}><X size={15} /></button></div>)}</div>}</DialogContent></Dialog>

    <Dialog open={!!sessionDetail} onOpenChange={(open) => { if (!open) setSessionDetail(null) }}><DialogContent className={`${styles.dialog} sm:max-w-lg`}><DialogHeader><DialogTitle>{sessionDetail?.person}</DialogTitle><DialogDescription>Completed assessment · {displayDate(sessionDetail?.point.completedAt)}</DialogDescription></DialogHeader>{sessionDetail && <><div className={styles.sessionScore}><strong>{sessionDetail.measure ? score(sessionDetail.point.value) : "—"}</strong><span>{sessionDetail.measure ? `${sessionDetail.measure} · Scaled score / 100` : "This measure was not recorded in this attempt"}</span></div><dl className={styles.sessionDetails}><div><dt>Assessment</dt><dd>{sessionDetail.point.assessmentName}</dd></div><div><dt>Campaign</dt><dd>{sessionDetail.point.campaignTitle}</dd></div><div><dt>Attempt</dt><dd>{sessionDetail.point.attemptNumber}</dd></div><div><dt>Stored interval</dt><dd>{sessionDetail.point.ciLower !== null && sessionDetail.point.ciUpper !== null ? `${score(sessionDetail.point.ciLower)}–${score(sessionDetail.point.ciUpper)}` : 'Not available'}</dd></div></dl>{experience !== 'compare' && <button className={styles.primaryButton} onClick={() => { update({ from: sessionDetail.point.completedAt.slice(0, 10), lens: 'time' }); setSessionDetail(null); toast.success('Baseline window updated') }}>Start the window here<ArrowRight size={15} /></button>}</>}</DialogContent></Dialog>
    <StudioExport dataset={dataset} settings={settings} title={reportTitle} open={exportOpen} onOpenChange={setExportOpen} />
  </div>
}
