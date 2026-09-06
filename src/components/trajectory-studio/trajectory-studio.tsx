'use client'

import { useCallback, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Bookmark, Check, CircleHelp, Download, GitCompareArrows, Layers, LayoutGrid, LineChart, Moon, Sun, Table2, TrendingUp, UserRound, Users, X } from 'lucide-react'
import { ThemeProvider as StudioThemeProvider, useTheme } from 'next-themes'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OVERALL_ID, type CanvasPoint } from '@/lib/canvas/types'
import { assessmentOptions, campaignOptions, displayDate, historySessions, initialSettings, initials, measures, referenceFor, referenceOptions, score, snapshotCaption, snapshotMeasures, snapshotSession, trajectorySeries, validateSavedSettings, type Experience, type StudioDataset, type StudioSettings } from '@/lib/trajectory-studio/model'
import { SERIES_COLORS } from './studio-chart'
import { StudioPeople } from './studio-people'
import { StudioTable } from './studio-table'
import { StudioSnapshot } from './studio-snapshot'
import { StudioSources } from './studio-sources'
import { StudioTimeline } from './studio-timeline'
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
  const result = dataset.result
  const [experience, setExperience] = useState<Experience>(initialExperience)
  const [views, setViews] = useState<Record<Experience, StudioSettings>>(() => Object.fromEntries(experiences.map((e) => {
    const settings = initialSettings(result, e.id)
    if (!dataset.demo && e.id !== 'individual') settings.people = result.people.map((p) => p.personKey)
    return [e.id, settings]
  })) as Record<Experience, StudioSettings>)
  const [exportOpen, setExportOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [saved, setSaved] = useState<SavedView[]>([])
  const [sessionDetail, setSessionDetail] = useState<{ point: CanvasPoint; person: string; measure: string } | null>(null)
  const { resolvedTheme, setTheme } = useTheme()
  const settings = views[experience]
  const time = settings.lens === 'time'
  const selected = settings.people.flatMap((key) => { const person = result.people.find((p) => p.personKey === key); return person ? [person] : [] })
  const single = selected.length === 1
  const firstPerson = selected[0]
  const allMeasures = measures(result, settings)
  const metric = allMeasures.find((m) => m.id === settings.metric)
  const assessments = assessmentOptions(result)
  const assessment = assessments.find((a) => a.id === settings.assessment)
  const campaigns = campaignOptions(result, settings.assessment)
  const colorFor = (key: string) => SERIES_COLORS[Math.max(0, result.people.findIndex((p) => p.personKey === key)) % SERIES_COLORS.length]
  const validRange = !time || !settings.from || !settings.to || settings.from <= settings.to
  const scopeAssessments = settings.representation === 'table' && settings.includeAllAssessments ? assessments : assessment ? [assessment] : []
  const totalSessions = scopeAssessments.reduce((count, a) => count + selected.reduce((total, p) => total + (time ? historySessions(result, p.personKey, { ...settings, assessment: a.id }).length : snapshotSession(result, p.personKey, { ...settings, assessment: a.id }) ? 1 : 0), 0), 0)
  const reference = referenceOptions(dataset, settings).find((r) => r.id === settings.reference)
  const shownMeasures = time ? trajectorySeries(dataset, settings).map((line) => line.entityId) : snapshotMeasures(result, settings).map((m) => m.id)
  const canShowDifference = shownMeasures.some((id) => referenceFor(dataset, settings, id).value !== null)
  const sourceLabel = dataset.demo ? 'Illustrative data' : 'Workspace data'
  const title = experience === 'compare' ? 'Compare' : 'Trajectory'
  const reportTitle = single && firstPerson ? `${firstPerson.displayName} · ${time ? 'Trajectory' : 'Snapshot'}` : time ? 'Trajectory · Progress report' : 'Trajectory · Comparison report'
  const storageKey = `trajectas-studio-v2-${dataset.demo ? 'demo' : result.clientId ?? 'workspace'}`

  const update = useCallback((patch: Partial<StudioSettings>) => {
    setViews((previous) => {
      const next = { ...previous[experience], ...patch }
      if (patch.assessment) {
        const available = measures(result, next)
        if (!available.some((m) => m.id === next.metric)) next.metric = available[0]?.id ?? OVERALL_ID
        const matched = next.timeMeasures.filter((id) => available.some((m) => m.id === id))
        const dimensions = available.filter((m) => m.level === 'dimension').slice(0, 5).map((m) => m.id)
        next.timeMeasures = matched.length ? matched : dimensions.length ? dimensions : available[0] ? [available[0].id] : []
        next.snapshotDetail = 'overview'
        next.campaign = 'all'
        if (!['group', 'none'].includes(next.reference) && !referenceOptions(dataset, next).some((r) => r.id === next.reference)) { next.reference = 'none'; next.valueMode = 'score' }
      }
      if (next.people.length < 2 && next.reference === 'group') { next.reference = 'none'; next.valueMode = 'score' }
      if (next.reference === 'none') next.valueMode = 'score'
      return { ...previous, [experience]: next }
    })
  }, [experience, result, dataset])
  function switchExperience(next: Experience) {
    setExperience(next)
    const url = new URL(window.location.href); url.searchParams.set('experience', next); window.history.replaceState(null, '', url)
  }
  function openSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as unknown
      setSaved((Array.isArray(raw) ? raw : []).filter((entry): entry is SavedView => !!entry && typeof entry === 'object' && typeof entry.name === 'string' && experiences.some((e) => e.id === entry.experience) && !!validateSavedSettings(entry.settings, result, dataset.references)).slice(0, 12))
    } catch { toast.error('Saved views could not be read on this device.') }
    setViewName(`${single && firstPerson ? firstPerson.displayName : assessment?.name ?? 'Assessment'} · ${time ? 'Progress' : 'Comparison'}`); setSaveOpen(true)
  }
  function saveView() {
    const name = viewName.trim(); if (!name) return
    const next = [{ name, experience, settings }, ...saved.filter((s) => s.name !== name)].slice(0, 12)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); toast.success('View saved on this device'); setSaveOpen(false) }
    catch { toast.error('This browser could not save the view. Check its storage settings.') }
  }
  function deleteView(index: number) {
    const next = saved.filter((_, i) => i !== index)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); toast.success('Saved view removed') }
    catch { toast.error('The view could not be removed.') }
  }
  function showSession(point: CanvasPoint, person: string, measure: string) { setSessionDetail({ point, person, measure }) }

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
        <header className={styles.header}><PageHeader title={title} eyebrow={experience === 'unified' ? 'Insights / One workspace, every perspective' : experience === 'individual' ? 'Insights / Individual growth' : 'Insights / People in perspective'} description={experience === 'individual' ? 'Follow the dimensions of a person’s development.' : experience === 'unified' ? 'See people side by side, then follow what changes.' : 'See each person clearly. Understand the differences.'} /><div className={styles.headerActions}><button className={styles.secondaryButton} onClick={openSaved}><Bookmark size={15} />Saved views</button><button className={styles.primaryButton} onClick={() => setExportOpen(true)} disabled={!totalSessions || !validRange}><Download size={15} />Export</button></div></header>
        <div className={styles.workspace}>
          <StudioPeople dataset={dataset} settings={settings} single={experience === 'individual'} onChange={update} onBrowse={onBrowse} />
          <div className={styles.results}>
            <section className={styles.contextBar} aria-label="Assessment and view">
              <label className={styles.assessmentSelect}><span><Layers size={14} />ASSESSMENT</span><select aria-label="Assessment" value={settings.assessment} onChange={(e) => update({ assessment: e.target.value })}>{!assessments.length && <option value="">Select people to see assessments</option>}{assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              {experience === 'unified' ? <div className={styles.lensToggle} aria-label="Analysis view"><button aria-pressed={!time} onClick={() => update({ lens: 'snapshot' })}><Users size={15} />Snapshot</button><button aria-pressed={time} onClick={() => update({ lens: 'time' })}><TrendingUp size={15} />Over time</button></div> : <span className={styles.contextLens}>{time ? <TrendingUp size={16} /> : <Users size={16} />}{time ? 'Over time' : 'Snapshot'}</span>}
            </section>
            <div className={styles.scopeBar}>{time ? <>
              <label><span>From</span><input aria-label="History start" type="date" value={settings.from} onChange={(e) => update({ from: e.target.value })} /></label>
              <label><span>To</span><input aria-label="History end" type="date" value={settings.to} onChange={(e) => update({ to: e.target.value })} /></label>
              <label className={styles.historyCampaign}><span>Campaigns</span><select aria-label="History campaigns" value={settings.campaign} onChange={(e) => update({ campaign: e.target.value })}><option value="all">All linked campaigns</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            </> : <><div><span>CAMPAIGN RESULTS</span><strong>{snapshotCaption(result, settings)}</strong><small>{totalSessions} selected result{totalSessions === 1 ? '' : 's'} · one completed attempt per person and assessment</small></div><button className={styles.secondaryButton} onClick={() => setSourcesOpen(true)} disabled={!selected.length}>Choose results<ArrowRight size={14} /></button></>}</div>
            <div className={styles.selectionStrip}><div className={styles.selectedChips}>{selected.map((person) => <span key={person.personKey} className={styles.personChip} style={{ '--person-color': colorFor(person.personKey) } as CSSProperties}><i />{person.displayName}{experience !== 'individual' && <button aria-label={`Remove ${person.displayName}`} onClick={() => update({ people: settings.people.filter((p) => p !== person.personKey) })}><X size={12} /></button>}</span>)}</div><span className={styles.sourceTag}><Check size={12} />Completed results</span></div>
            {!validRange && <Alert variant="warning"><AlertTitle>Check the date range</AlertTitle><AlertDescription>The start date must be on or before the end date.</AlertDescription></Alert>}
            {!selected.length ? <div className={styles.emptyPanel}><EmptyState title="Choose people to begin" description="Select people from the panel, then choose an assessment." />{onBrowse && <button className={styles.primaryButton} onClick={onBrowse}>Browse workspace participants<ArrowRight size={16} /></button>}</div> : <>
              {time && single && firstPerson && <div className={styles.personHero}><span className={styles.heroAvatar} style={{ '--person-color': colorFor(firstPerson.personKey) } as CSSProperties}>{initials(firstPerson.displayName)}</span><div><p>INDIVIDUAL TRAJECTORY</p><h2>{firstPerson.displayName}</h2><span>{dataset.context?.[firstPerson.personKey]?.role ?? firstPerson.email}</span></div><div className={styles.heroSessionCount}><strong>{totalSessions}</strong><span>completed results</span></div></div>}
              <section className={styles.chartPanel} aria-label={time ? 'Progress chart' : 'Comparison profile'}>
                <div className={styles.chartHeader}><div><p className={styles.overline}>{time ? single ? 'ONE PERSON · MULTIPLE MEASURES' : 'MULTIPLE PEOPLE · ONE MEASURE' : 'PEOPLE IN PERSPECTIVE'}</p><h2>{time ? single ? 'How the measures change' : `${metric?.name ?? 'Score'} over time` : settings.snapshotDetail === 'overview' ? 'The dimension profile' : `${allMeasures.find((m) => m.id === settings.snapshotDetail)?.name ?? 'Dimension'} · factors`}</h2><p>{time ? single ? 'See several measures together, on the dates they were assessed.' : 'Compare the same measure across people’s assessment histories.' : 'Named results, a shared scale, and a reference you can see.'}</p></div><div className={styles.chartViewToggle}><button aria-label="Show chart" aria-pressed={settings.representation === 'chart'} onClick={() => update({ representation: 'chart' })}>{time ? <LineChart size={16} /> : <LayoutGrid size={16} />}</button><button aria-label="Show score matrix" aria-pressed={settings.representation === 'table'} onClick={() => update({ representation: 'table' })}><Table2 size={16} /></button></div></div>
                <div className={styles.analysisControls}>
                  {!time && settings.representation === 'chart' && <label>Measures<select aria-label="Snapshot measures" value={settings.snapshotDetail} onChange={(e) => update({ snapshotDetail: e.target.value })}><option value="overview">Overall & dimensions</option>{allMeasures.filter((m) => m.level === 'dimension' && allMeasures.some((f) => f.parentId === m.id)).map((m) => <option key={m.id} value={m.id}>{m.name} · factors</option>)}</select></label>}
                  {time && !single && <label>Measure<select aria-label="Focus measure" value={settings.metric} onChange={(e) => update({ metric: e.target.value })}>{allMeasures.map((m) => <option key={m.id} value={m.id}>{m.level === 'factor' ? '↳ ' : ''}{m.name}</option>)}</select></label>}
                  <label>Reference<select aria-label="Reference" value={settings.reference} onChange={(e) => update({ reference: e.target.value })}><option value="none">None</option>{selected.length >= 2 && <option value="group">{time ? 'Group snapshot mean · fixed' : 'Selected group mean'}</option>}{referenceOptions(dataset, settings).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                  <div className={styles.valueToggle} aria-label="Score display"><button aria-pressed={settings.valueMode === 'score'} onClick={() => update({ valueMode: 'score' })}>Scores</button><button disabled={!canShowDifference} aria-pressed={settings.valueMode === 'difference'} onClick={() => update({ valueMode: 'difference' })}>Difference</button></div>
                </div>
                <div className={styles.referenceContext}>{settings.reference === 'group' ? <p><span className={styles.referenceMark} />{time ? 'A fixed mean from the selected snapshot results.' : 'The mean of the selected people, calculated separately for each measure.'} Missing scores are excluded.{time && <button onClick={() => setSourcesOpen(true)}>Review reference results<ArrowUpRight size={12} /></button>}</p> : reference ? <p><span className={styles.referenceMark} />{reference.illustrative ? 'Illustrative reference' : reference.kind === 'norm' ? 'Norm reference' : 'Target'} · {reference.version}<button onClick={() => setHelpOpen(true)}>About this reference<CircleHelp size={12} /></button></p> : <p>Scores stay on their assessment’s 0–100 scale.{!referenceOptions(dataset, settings).length && ' No compatible norm or target has been supplied.'}</p>}</div>
                {!validRange ? <EmptyState size="sm" title="Adjust the dates to view results" description="The start date must be on or before the end date." /> : !totalSessions ? <EmptyState size="sm" title={time ? 'No completed results in this date range' : 'No campaign results selected'} description={time ? 'Try another campaign, assessment or date range.' : 'Choose results to select a completed campaign result for each person.'} /> : settings.representation === 'table' ? <>
                  {assessments.length > 1 && <label className={`${styles.checkLabel} ${styles.matrixScope}`}><input type="checkbox" checked={settings.includeAllAssessments} onChange={(e) => update({ includeAllAssessments: e.target.checked })} /><span><strong>Include all {assessments.length} assessments</strong><small>Separate measures and reference calculations for each instrument.</small></span></label>}
                  {scopeAssessments.map((a) => <section key={a.id}>{settings.includeAllAssessments && <h3 className={styles.matrixTitle}>{a.name}</h3>}<StudioTable dataset={dataset} settings={{ ...settings, assessment: a.id }} /></section>)}
                </> : time ? <StudioTimeline dataset={dataset} settings={settings} onChange={update} onSession={showSession} /> : <StudioSnapshot dataset={dataset} settings={settings} onSession={showSession} />}
              </section>
              {time && <details className={styles.historyDisclosure}><summary>Assessment history <span>{totalSessions} completed results</span></summary><div>{selected.map((person) => <section key={person.personKey}><h3>{person.displayName}</h3>{historySessions(result, person.personKey, settings).map((session) => <p key={session.sessionId}><strong>{displayDate(session.completedAt)}</strong><span>{session.campaignTitle}</span><small>Attempt {session.attemptNumber}</small></p>)}</section>)}</div></details>}
              <footer className={styles.resultsFooter}><span>{selected.length} {single ? 'person' : 'people'} · {totalSessions} {time ? 'completed' : 'selected'} results · {sourceLabel}</span><button onClick={() => setHelpOpen(true)}>Score scale & reference details<CircleHelp size={13} /></button></footer>
            </>}
          </div>
        </div>
      </main>
    </div>
    <StudioSources dataset={dataset} settings={settings} open={sourcesOpen} onOpenChange={setSourcesOpen} onChange={update} />
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className={`${styles.dialog} sm:max-w-xl max-h-[85dvh] overflow-y-auto`}><DialogHeader><DialogTitle>Scores and references</DialogTitle><DialogDescription>{assessment?.name ?? 'Your assessment'}</DialogDescription></DialogHeader><div className={styles.methodology}>
      <p><strong>Snapshot selects a result.</strong> Each person contributes one completed assessment attempt from a campaign. Choose results to change a campaign or use an earlier attempt. That selection is independent of the history date range.</p>
      <p><strong>The selected group mean is descriptive.</strong> It is calculated from the available scores for each measure, including the person being compared. The sample size is shown as n. Two measured results are needed. It changes when you change people or results; it is not a population norm.</p>
      <p><strong>History follows actual assessment dates.</strong> One person can have up to six measures on the same graph. Multiple people share one measure. Change is latest minus first in the date range; it does not establish significance or explain its cause.</p>
      <p><strong>A reference stays fixed across history.</strong> Dashed lines show its score for each measure. Difference view subtracts that measure’s reference value, putting every measure’s reference at zero. It does not re-norm historic percentiles.</p>
      {reference ? <><h3>{reference.name}</h3><p>{reference.description}</p><p>Version: {reference.version}. Scale: 0–100. Sample sizes are shown per measure where supplied.</p></> : !referenceOptions(dataset, settings).length && <p><strong>Norms and targets.</strong> This assessment has no compatible reference in the results feed. A reference needs the same assessment and score scale, measure-level values and a version. A target is a specified goal, not an expected population score.</p>}
      <p><strong>Missing scores stay missing.</strong> A missing factor is never filled from an older attempt or shown as zero. Different assessments retain their own measures and references. A higher preference score is not necessarily better.</p>
      {dataset.demo && <p className={styles.demoNotice}>People, assessments, results, norms and targets in this preview are fictional examples for design review.</p>}
    </div></DialogContent></Dialog>
    <Dialog open={saveOpen} onOpenChange={setSaveOpen}><DialogContent className={`${styles.dialog} sm:max-w-lg`}><DialogHeader><DialogTitle>Saved views</DialogTitle><DialogDescription>Save selections and settings on this device. Scores are read again from the available dataset when you reopen a view.</DialogDescription></DialogHeader><label className={styles.field}><span>View name</span><input aria-label="View name" maxLength={100} value={viewName} onChange={(e) => setViewName(e.target.value)} /></label><button className={styles.primaryButton} disabled={!viewName.trim()} onClick={saveView}><Bookmark size={15} />Save current view</button>{saved.length > 0 && <div className={styles.savedViews}>{saved.map((entry, index) => <div key={index}><button onClick={() => { const valid = validateSavedSettings(entry.settings, result, dataset.references); if (!valid) { toast.error('This view is no longer available for the current dataset.'); return }; setViews((previous) => ({ ...previous, [entry.experience]: valid })); switchExperience(entry.experience); setSaveOpen(false); toast.success('Saved view opened') }}><Bookmark size={14} /><span><strong>{entry.name}</strong><small>{entry.settings.people.length} people · {entry.settings.lens === 'time' ? 'Over time' : 'Snapshot'}</small></span><ArrowUpRight size={14} /></button><button aria-label={`Delete saved view ${entry.name}`} onClick={() => deleteView(index)}><X size={15} /></button></div>)}</div>}</DialogContent></Dialog>

    <Dialog open={!!sessionDetail} onOpenChange={(open) => { if (!open) setSessionDetail(null) }}><DialogContent className={`${styles.dialog} sm:max-w-lg`}><DialogHeader><DialogTitle>{sessionDetail?.person}</DialogTitle><DialogDescription>{sessionDetail?.measure} · {displayDate(sessionDetail?.point.completedAt)}</DialogDescription></DialogHeader>{sessionDetail && <><div className={styles.sessionScore}><strong>{score(sessionDetail.point.value)}</strong><span>{sessionDetail.measure} · score / 100</span></div><dl className={styles.sessionDetails}><div><dt>Assessment</dt><dd>{sessionDetail.point.assessmentName}</dd></div><div><dt>Campaign</dt><dd>{sessionDetail.point.campaignTitle}</dd></div><div><dt>Attempt</dt><dd>{sessionDetail.point.attemptNumber}</dd></div><div><dt>Stored interval</dt><dd>{sessionDetail.point.ciLower !== null && sessionDetail.point.ciUpper !== null ? `${score(sessionDetail.point.ciLower)}–${score(sessionDetail.point.ciUpper)}` : 'Not supplied'}</dd></div></dl>{time && <button className={styles.secondaryButton} onClick={() => { update({ from: sessionDetail.point.completedAt.slice(0, 10) }); setSessionDetail(null) }}>Start history here<ArrowRight size={15} /></button>}</>}</DialogContent></Dialog>
    <StudioExport dataset={dataset} settings={settings} title={reportTitle} open={exportOpen} onOpenChange={setExportOpen} />
  </div>
}
