'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { PARTICIPANT_NOTICE_DRAFT, WEBSITE_PRIVACY_DRAFT } from '@/lib/privacy/drafts'
import type { getPrivacyDashboard, getPrivacyCampaigns, getResearchWorkbench, findPrivacyParticipants, getParticipantResearchSessions } from '@/lib/dal/privacy'
import type { DeletionManifest } from '@/lib/privacy/types'
import * as actions from '@/app/actions/privacy'

type Dashboard = Awaited<ReturnType<typeof getPrivacyDashboard>>
type Props = { dashboard: Dashboard; campaigns: Awaited<ReturnType<typeof getPrivacyCampaigns>>; research: Awaited<ReturnType<typeof getResearchWorkbench>>; mode: string }
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
const text = (f: FormData, key: string) => String(f.get(key) ?? '').trim()
const number = (f: FormData, key: string) => text(f,key) ? Number(text(f,key)) : null
const date = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>
}
function Select({ name, children, required = true }: { name: string; children: ReactNode; required?: boolean }) {
  return <select name={name} required={required} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose…</option>{children}</select>
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-5 border-t border-border pt-6"><h2 className="text-section">{title}</h2>{children}</section>
}
function ReviewTable<T extends { id: string }>({ data, columns, onReview }: { data: T[]; columns: ColumnDef<T>[]; onReview: (rows: T[]) => void }) {
  return <DataTable data={data} columns={columns} getRowId={row=>row.id} onRowClick={row=>onReview([row])} enableRowSelection bulkActions={[{ label:'Review selected', action:(_ids,rows)=>onReview(rows) }]} />
}

export function PrivacySettings({ dashboard, campaigns, research, mode }: Props) {
  const router = useRouter()
  const [tab,setTab] = useState('policies')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [dirty,setDirty] = useState(false)
  const navigation = useUnsavedChanges(dirty)
  const [confirmation,setConfirmation] = useState<{ title: string; description: string; work: () => Promise<Result<unknown>> } | null>(null)
  const [reviewPolicyIds,setReviewPolicyIds]=useState<string[]>([])
  const reviewPolicies=dashboard.policies.filter(row=>reviewPolicyIds.includes(row.id))
  const setReviewPolicies=(rows:Dashboard['policies'])=>setReviewPolicyIds(rows.map(row=>row.id))
  const [reviewRequestIds,setReviewRequestIds]=useState<string[]>([])
  const reviewRequests=dashboard.requests.filter(row=>reviewRequestIds.includes(row.id))
  const setReviewRequests=(rows:Dashboard['requests'])=>setReviewRequestIds(rows.map(row=>row.id))
  const [reviewHoldIds,setReviewHoldIds]=useState<string[]>([])
  const reviewHolds=dashboard.holds.filter(row=>reviewHoldIds.includes(row.id))
  const setReviewHolds=(rows:Dashboard['holds'])=>setReviewHoldIds(rows.map(row=>row.id))
  const [noticeId,setNoticeId] = useState<string|null>(null)
  const notice=dashboard.notices.find(row=>row.id===noticeId)??null
  const setNotice=(value:Dashboard['notices'][number]|null)=>setNoticeId(value?.id??null)
  const [editingPolicyId,setEditingPolicyId]=useState<string|null>(null)
  const editingPolicy=dashboard.policies.find(row=>row.id===editingPolicyId)??null
  const [draftAudience,setDraftAudience] = useState<'participant'|'website'>('participant')
  const [participants,setParticipants] = useState<Awaited<ReturnType<typeof findPrivacyParticipants>>>([])
  const [participant,setParticipant] = useState<Awaited<ReturnType<typeof findPrivacyParticipants>>[number] | null>(null)
  const [manifest,setManifest] = useState<DeletionManifest | null>(null)
  const [sessions,setSessions] = useState<Awaited<ReturnType<typeof getParticipantResearchSessions>>>([])
  const [cohort,setCohort] = useState<Props['research']['cases']>([])
  const [reviewRelease,setReviewRelease] = useState<Props['research']['releases'][number] | null>(null)
  const activePolicies = dashboard.policies.filter(p=>p.scope==='assessment' && p.status==='active' && !p.recoveryOnly)
  const publishedNotices = dashboard.notices.filter(n=>n.audience==='participant' && n.status==='published')

  async function run<T>(work: () => Promise<Result<T>>, success: string, done?: (value:T)=>void) {
    if (busy) return
    setBusy(true);setError('')
    try {
      const result = await work()
      if (!result.ok) { setError(result.error);toast.error(result.error,{duration:Infinity});return }
      done?.(result.data);setDirty(false);setConfirmation(null);toast.success(success);router.refresh()
    } catch { const message='The operation could not be completed. Review its status before retrying.';setError(message);toast.error(message,{duration:Infinity}) }
    finally {setBusy(false)}
  }
  function submit<T>(e: FormEvent<HTMLFormElement>, work: (f:FormData)=>Promise<Result<T>>, success: string,done?:(value:T)=>void) {
    e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>work(f),success,done)
  }
  const noticeDefaults = notice ?? { ...(draftAudience==='participant'?PARTICIPANT_NOTICE_DRAFT:WEBSITE_PRIVACY_DRAFT), audience:draftAudience,version:'',researchChoiceEnabled:false }
  const policyColumns: ColumnDef<Dashboard['policies'][number]>[] = [
    {accessorKey:'name',header:'Policy'}, {accessorKey:'version',header:'Version'}, {accessorKey:'scope',header:'Scope'}, {accessorKey:'status',header:'Status'},
    {id:'duration',header:'Retention',cell:({row})=>row.original.scope==='assessment'?`${row.original.retentionMonths} months after closure`:`${row.original.diagnosticDays} day diagnostics / ${row.original.auditDays} day audit`},
    {accessorKey:'backupDays',header:'Backup tail (days)'},
  ]
  return <div className="space-y-6">
    <Alert variant="info"><AlertDescription>Disposal mode: <strong>{mode}</strong>. Drafts have no effect until approved and assigned. External copies and backup expiry require separate evidence.</AlertDescription></Alert>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <nav aria-label="Privacy settings sections" className="flex flex-wrap gap-2">{['policies','notices','campaigns','disposal','holds','research'].map(name=><Button key={name} variant={tab===name?'default':'outline'} onClick={()=>{if(dirty){toast.error('Save your draft before changing sections.');return}setTab(name)}} className="capitalize">{name}</Button>)}</nav>

    {tab==='policies' && <>
      <ReviewTable data={dashboard.policies} columns={policyColumns} onReview={setReviewPolicies} />
      {reviewPolicies.map(policy=><div className="flex items-center justify-between gap-4 rounded-lg border p-4" key={policy.id}><p>{policy.name} · {policy.version} · research {policy.researchAllowed?'permitted after review':'disabled'}</p>{policy.status==='draft' && <Button variant="outline" onClick={()=>{if(!dirty)setEditingPolicyId(policy.id)}}>Complete draft</Button>}{policy.status==='draft' && <Button disabled={busy} onClick={()=>setConfirmation({title:`Approve ${policy.name}?`,description:'Confirm the retention period, backup tail, customer agreement and research basis have been reviewed. Approval makes this version immutable. Campaign assignment is separate.',work:()=>actions.activateRetentionPolicyAction(policy.id,'APPROVE_RETENTION_POLICY')})}>Approve policy</Button>}</div>)}
      <Section title={editingPolicy?`Edit ${editingPolicy.name}`:"New retention policy draft"}><Button variant="outline" onClick={()=>{if(!dirty)setEditingPolicyId(null)}}>New policy draft</Button><form key={editingPolicyId??'new'} className="grid gap-4 sm:grid-cols-2" onChange={()=>setDirty(true)} onSubmit={e=>submit(e,f=>{const value={name:text(f,'name'),version:text(f,'version'),scope:text(f,'scope'),retentionMonths:number(f,'months'),backupDays:number(f,'backup'),diagnosticDays:number(f,'diagnostics'),auditDays:number(f,'audit'),researchAllowed:f.has('research')};return editingPolicy?actions.updateRetentionPolicyDraftAction(editingPolicy.id,value):actions.createRetentionPolicyDraftAction(value)},'Policy draft saved',setEditingPolicyId)}>
        <Field label="Name"><Input name="name" defaultValue={editingPolicy?.name??''} required maxLength={120} /></Field><Field label="Version"><Input name="version" defaultValue={editingPolicy?.version??''} required maxLength={80} /></Field>
        <Field label="Scope"><select name="scope" defaultValue={editingPolicy?.scope??'assessment'} className="h-10 rounded-md border bg-background px-3"><option value="assessment">Assessment</option><option value="operations">Operations</option></select></Field>
        <Field label="Assessment months after campaign closure"><Input name="months" defaultValue={editingPolicy?.retentionMonths??''} type="number" min={1} max={120} /></Field>
        <Field label="Longest backup and recovery window in days"><Input name="backup" defaultValue={editingPolicy?.backupDays??''} type="number" required min={1} max={365} /></Field>
        <Field label="Diagnostic retention in days (operations)"><Input name="diagnostics" defaultValue={editingPolicy?.diagnosticDays??''} type="number" min={1} max={365} /></Field>
        <Field label="Audit retention in days (operations)"><Input name="audit" defaultValue={editingPolicy?.auditDays??''} type="number" min={1} max={3650} /></Field>
        <label className="flex items-center gap-2 text-sm"><input name="research" type="checkbox" defaultChecked={editingPolicy?.researchAllowed??false} />Permit separately reviewed research</label>
        <Button type="submit" disabled={busy} className="w-fit">{busy?'Saving…':'Save draft'}</Button>
      </form></Section>
    </>}

    {tab==='notices' && <>
      <ReviewTable data={dashboard.notices} columns={[{accessorKey:'title',header:'Notice'},{accessorKey:'version',header:'Version'},{accessorKey:'audience',header:'Audience'},{accessorKey:'status',header:'Status'}]} onReview={rows=>{if(dirty){toast.error('Save the current draft first.');return}setNotice(rows[0])}} />
      <Section title={notice?`${notice.title} · ${notice.status}`:'New notice draft'}>
        <p className="text-sm text-muted-foreground">Review the legal entity, contact, processor locations, retention and research wording before publication. A published website policy becomes public; a participant notice must also be assigned to a campaign.</p>
        <div className="flex gap-2"><Button variant="outline" onClick={()=>{if(dirty)return;setNotice(null);setDraftAudience('participant')}}>New participant draft</Button><Button variant="outline" onClick={()=>{if(dirty)return;setNotice(null);setDraftAudience('website')}}>New website draft</Button></div>
        <form key={notice?.id??draftAudience} className="grid gap-4" onChange={()=>setDirty(true)} onSubmit={e=>submit(e,f=>{
          const value={version:text(f,'version'),audience:text(f,'audience'),title:text(f,'title'),body:text(f,'body'),acknowledgementLabel:text(f,'acknowledgement'),researchLabel:text(f,'researchLabel'),researchChoiceEnabled:f.has('researchChoice')}
          return notice?actions.updatePrivacyNoticeDraftAction(notice.id,value):actions.createPrivacyNoticeDraftAction(value)
        },'Notice draft saved',setNoticeId)}>
          <fieldset disabled={busy || (notice!==null&&notice.status!=='draft')} className="grid gap-4">
            <Field label="Version"><Input name="version" defaultValue={noticeDefaults.version} required maxLength={80} /></Field>
            <Field label="Audience"><select name="audience" defaultValue={noticeDefaults.audience} className="h-10 rounded-md border bg-background px-3"><option value="participant">Participant</option><option value="website">Website</option></select></Field>
            <Field label="Title"><Input name="title" required defaultValue={noticeDefaults.title} maxLength={160} /></Field>
            <Field label="Privacy text"><Textarea name="body" required defaultValue={noticeDefaults.body} rows={20} maxLength={40000} /></Field>
            <Field label="Acknowledgement"><Input name="acknowledgement" required defaultValue={noticeDefaults.acknowledgementLabel} maxLength={500} /></Field>
            <label className="flex items-center gap-2 text-sm"><input name="researchChoice" type="checkbox" defaultChecked={noticeDefaults.researchChoiceEnabled} />Offer separate optional research consent</label>
            <Field label="Research choice wording"><Textarea name="researchLabel" defaultValue={noticeDefaults.researchLabel} maxLength={1000} /></Field>
            <Button type="submit" className="w-fit">{busy?'Saving…':'Save draft'}</Button>
          </fieldset>
        </form>
        {notice?.status==='draft' && <Button disabled={busy||dirty} onClick={()=>setConfirmation({title:'Publish this reviewed notice?',description:`Publish ${notice.version} for ${notice.audience}. Confirm you have read the saved text and approved its customer-facing claims.`,work:()=>actions.publishPrivacyNoticeAction(notice.id,notice.hash,'PUBLISH_REVIEWED_NOTICE')})}>Publish reviewed notice</Button>}
      </Section>
    </>}

    {tab==='campaigns' && <Section title="Assign an approved policy and notice"><p className="text-sm text-muted-foreground">Notice acknowledgement applies to participants created after assignment. Previously delivered forms keep their original behaviour. Closure starts the retention clock and cannot be reset here.</p>
      <form className="grid gap-4 sm:grid-cols-2" onChange={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const input={campaignId:text(f,'campaign'),policyId:text(f,'policy'),noticeId:text(f,'notice'),closedAt:text(f,'closed')?new Date(text(f,'closed')).toISOString():null};const policy=activePolicies.find(row=>row.id===input.policyId);setConfirmation({title:`Apply privacy settings to ${campaigns.find(row=>row.id===input.campaignId)?.title??'this campaign'}?`,description:`Apply ${policy?.name??'the selected policy'}. A past closure can make existing records due for permanent disposal. A recorded closure cannot be reset here. Confirm the customer terms and retention schedule; the notice applies to new participants.`,work:()=>actions.setCampaignPrivacyAction(input)})}}>
        <Field label="Campaign"><Select name="campaign">{campaigns.map(c=><option key={c.id} value={c.id}>{c.title} · {c.status}</option>)}</Select></Field>
        <Field label="Approved assessment policy"><Select name="policy">{activePolicies.map(p=><option key={p.id} value={p.id}>{p.name} · {p.version}</option>)}</Select></Field>
        <Field label="Published participant notice"><Select name="notice">{publishedNotices.map(n=><option key={n.id} value={n.id}>{n.title} · {n.version}</option>)}</Select></Field>
        <Field label="Actual closure date, if already closed"><Input name="closed" type="date" /></Field><Button type="submit" disabled={busy} className="w-fit">Save assignment</Button>
      </form>
    </Section>}

    {(tab==='disposal'||tab==='research') && <Section title="Find participant"><form className="flex items-end gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>actions.findPrivacyParticipantsAction(text(f,'email')),'Search completed',setParticipants)}}><Field label="Exact participant email"><Input name="email" type="email" required /></Field><Button type="submit" disabled={busy}>Find</Button></form>
      <ReviewTable data={participants} columns={[{accessorKey:'name',header:'Participant'},{accessorKey:'campaign',header:'Campaign'},{accessorKey:'client',header:'Client'},{accessorKey:'status',header:'Status'}]} onReview={rows=>{const selected=rows[0];setParticipant(selected);setManifest(null);setSessions([]);if(tab==='disposal')void run(()=>actions.previewParticipantDeletionAction(selected.id),'Deletion scope loaded',setManifest);else void run(()=>actions.getParticipantResearchSessionsAction(selected.id),'Sessions loaded',setSessions)}} />
    </Section>}

    {tab==='disposal' && <>
      {participant&&manifest&&<Section title={`Deletion review: ${participant.name} · ${participant.campaign}`}><dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(manifest.counts).map(([key,value])=><div key={key}><dt className="capitalize text-muted-foreground">{key}</dt><dd className="tabular-nums">{value}</dd></div>)}</dl>
        {manifest.blockers.length>0&&<Alert variant="warning"><AlertDescription>{manifest.blockers.length} shared or legacy copies need review. Disposal will stop for that review.</AlertDescription></Alert>}
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={e=>submit(e,f=>actions.requestParticipantDeletionAction({participantId:participant.id,policyId:text(f,'policy'),reason:text(f,'reason') as 'individual_request'|'engagement_end'}),'Deletion request recorded')}>
          <Field label="Approved policy"><Select name="policy">{activePolicies.map(p=><option key={p.id} value={p.id}>{p.name} · {p.version}</option>)}</Select></Field>
          <Field label="Reason"><Select name="reason"><option value="individual_request">Verified individual request</option><option value="engagement_end">Engagement ended</option></Select></Field><Button type="submit" disabled={busy} className="w-fit">Record deletion request</Button>
        </form></Section>}
      <Section title="Deletion requests"><ReviewTable data={dashboard.requests} columns={[{id:'target',header:'Participant',cell:({row})=>row.original.target?`${row.original.target.name} · ${row.original.target.campaign}`:'Active identity removed'},{accessorKey:'reason',header:'Reason'},{accessorKey:'status',header:'Status'},{id:'backup',header:'Recovery tail ends',cell:({row})=>date(row.original.backupExpiresAt)},{accessorKey:'lastErrorCode',header:'Review code'}]} onReview={setReviewRequests} />
        {reviewRequests.map(request=><div className="space-y-3 rounded-xl border p-4" key={request.id}><p className="font-semibold">{request.target?`${request.target.name} · ${request.target.campaign}`:'Identity removed'} · {request.status}</p><p className="text-sm">{Object.entries(request.counts??{}).map(([k,v])=>`${v} ${k}`).join(' · ')||'Scope is checked again before processing.'}</p>
          {['requested','review_required','failed'].includes(request.status)&&<Button disabled={busy} variant="destructive" onClick={()=>setConfirmation({title:'Approve permanent disposal?',description:`Approve ${request.target?.name??'this request'} in ${request.target?.campaign??'its original campaign'}. Access will be revoked when processing starts. Active records and files are permanently removed after holds and shared-copy checks. This has no undo.`,work:()=>actions.approveParticipantDeletionAction(request.id,'APPROVE_PERMANENT_DELETION')})}>Approve permanent disposal</Button>}
          {request.providerTasks.filter(task=>task.status!=='confirmed').map(task=><form key={task.processor} className="flex flex-wrap items-end gap-3" onSubmit={e=>submit(e,f=>actions.confirmDeletionProviderTaskAction({requestId:request.id,processor:task.processor,evidenceRef:text(f,'evidence')}),'Processor evidence recorded')}><p className="text-sm">Pending: {task.processor.replaceAll('_',' ')}</p><Field label="Verified processor evidence reference"><Input name="evidence" required pattern="[a-zA-Z0-9_.:\-]{1,120}" placeholder="Register reference, no personal data" /></Field><Button type="submit" disabled={busy} variant="outline">Confirm evidence</Button></form>)}
        </div>)}
      </Section>
    </>}

    {tab==='holds' && <>
      <ReviewTable data={dashboard.holds} columns={[{accessorKey:'reason',header:'Reason'},{id:'scope',header:'Scope',cell:({row})=>`${campaigns.find(c=>c.id===row.original.campaignId)?.title??'Campaign'} · ${row.original.participantId?'individual':'campaign'}`},{id:'review',header:'Review due',cell:({row})=>date(row.original.reviewAt)}]} onReview={setReviewHolds} />
      {reviewHolds.map(hold=><div key={hold.id} className="flex items-center justify-between gap-4 rounded-lg border p-4"><p>{hold.reason}</p><Button variant="outline" disabled={busy} onClick={()=>setConfirmation({title:'Release this legal hold?',description:'Confirm the underlying obligation has ended. Releasing the hold can allow previously approved disposal to resume.',work:()=>actions.releasePrivacyHoldAction(hold.id,'RELEASE_LEGAL_HOLD')})}>Release hold</Button></div>)}
      <Section title="Place a campaign hold"><form className="grid gap-4 sm:grid-cols-2" onChange={()=>setDirty(true)} onSubmit={e=>submit(e,f=>actions.createPrivacyHoldAction({campaignId:text(f,'campaign'),participantId:null,reason:text(f,'reason'),reviewAt:new Date(`${text(f,'review')}T23:59:59Z`).toISOString()}),'Legal hold recorded')}>
        <Field label="Campaign"><Select name="campaign">{campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field><Field label="Review date"><Input name="review" required type="date" /></Field><Field label="Reason (avoid unnecessary personal detail)"><Textarea name="reason" required maxLength={1000} /></Field><Button type="submit" disabled={busy} className="w-fit">Place hold</Button>
      </form></Section>
    </>}

    {tab==='research' && <>
      <Alert variant="info"><AlertDescription>Restricted research rows remain personal information and expire within 90 days or the source deadline. Aggregate release requires privacy and psychometric review. A sample of 20 is a minimum check, not proof of anonymity. Releases do not change live scoring.</AlertDescription></Alert>
      {participant&&<Section title={`Research extraction: ${participant.name}`}><Button disabled={busy} variant="outline" onClick={()=>setConfirmation({title:"Exclude this participant from research?",description:"This removes restricted research rows and blocks future extraction. Previously approved aggregate statistics have no individual membership link and cannot be recalculated by identifying this person.",work:()=>actions.restrictParticipantResearchAction(participant.id)})}>Exclude from research</Button><form className="grid gap-4 sm:grid-cols-2" onSubmit={e=>submit(e,f=>actions.extractRestrictedResearchCaseAction({sessionId:text(f,'session'),permissionBasis:text(f,'basis'),permissionRef:text(f,'reference')}),'Restricted research case prepared')}>
        <Field label="Completed session"><Select name="session">{sessions.map(s=><option key={s.id} value={s.id}>{s.title} · {date(s.completedAt)}</option>)}</Select></Field>
        <Field label="Reviewed permission basis"><Select name="basis"><option value="participant_consent">Recorded participant consent</option><option value="customer_permission">Documented customer permission and lawful purpose</option><option value="related_expected_purpose">Reviewed related and expected purpose</option></Select></Field>
        <Field label="Permission decision reference"><Input name="reference" required pattern="[a-zA-Z0-9_.:\-]{1,120}" /></Field><Button type="submit" disabled={busy} className="w-fit">Prepare restricted case</Button>
      </form></Section>}
      <Section title="Restricted workbench"><ReviewTable data={research.cases} columns={[{accessorKey:'scoringVersion',header:'Scoring version'},{accessorKey:'permissionBasis',header:'Permission basis'},{id:'form',header:'Frozen form',cell:({row})=>row.original.formFingerprint.slice(0,12)},{id:'expires',header:'Expires',cell:({row})=>date(row.original.expiresAt)}]} onReview={setCohort} />
        <p className="text-sm">{cohort.length} cases selected for review.</p>
        {cohort.length>=20&&<form className="grid gap-4 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setConfirmation({title:'Release reviewed aggregate statistics?',description:`Release statistics from ${cohort.length} cases. Confirm the privacy risk and psychometric quality decisions approve this exact cohort and its release context, including possible differencing with other releases.`,work:()=>actions.publishReviewedNormAction({caseIds:cohort.map(c=>c.id),version:text(f,'version'),instrumentKey:text(f,'instrument'),riskRef:text(f,'risk'),qualityRef:text(f,'quality'),confirmation:'APPROVE_AGGREGATE_RELEASE'})})}}>
          <Field label="Release version"><Input name="version" required maxLength={80} /></Field><Field label="Instrument key"><Input name="instrument" required pattern="[a-zA-Z0-9_.\-]{1,80}" /></Field><Field label="Privacy risk decision reference"><Input name="risk" required pattern="[a-zA-Z0-9_.:\-]{1,120}" /></Field><Field label="Psychometric quality decision reference"><Input name="quality" required pattern="[a-zA-Z0-9_.:\-]{1,120}" /></Field><Button type="submit" disabled={busy} className="w-fit">Review aggregate release</Button>
        </form>}
      </Section>
      <Section title="Approved aggregate releases"><ReviewTable data={research.releases} columns={[{accessorKey:'version',header:'Version'},{accessorKey:'instrumentKey',header:'Instrument'},{accessorKey:'sampleCount',header:'Sample'},{id:'date',header:'Reviewed',cell:({row})=>date(row.original.reviewedAt)}]} onReview={rows=>setReviewRelease(rows[0])} />{reviewRelease&&<pre className="overflow-auto rounded-xl border p-4 text-xs">{JSON.stringify(reviewRelease.payload,null,2)}</pre>}</Section>
    </>}
    <ConfirmDialog open={confirmation!==null} onOpenChange={open=>{if(!open&&!busy)setConfirmation(null)}} title={confirmation?.title??''} description={confirmation?.description??''} confirmLabel="Confirm reviewed action" variant="destructive" loading={busy} onConfirm={()=>{if(confirmation)void run(confirmation.work,'Reviewed action recorded')}} />
    <ConfirmDialog open={navigation.showDialog} onOpenChange={open=>{if(!open)navigation.cancelNavigation()}} title="Discard unsaved changes?" description="Your draft changes have not been saved." confirmLabel="Discard changes" onConfirm={navigation.confirmNavigation} />
  </div>
}
