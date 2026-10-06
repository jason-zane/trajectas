'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createNormStudyDefinition, createNormStudySnapshot, approveResearchObservations } from '@/app/actions/norm-studies';
import { DEFAULT_DEMOGRAPHICS_CONFIG } from '@/lib/experience/defaults';

interface Props {
  assessments: { id: string; title: string }[];
  studies: { id: string; name: string; population: string; minimumSampleSize: number; versions: { id: string; sampleSize: number; createdAt: string }[] }[];
  reviewQueue: { id: string; participant: string; assessment: string; campaign: string; completedAt: string }[];
}
export function NormStudyManager({ assessments, studies, reviewQueue }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceEvidence, setSourceEvidence] = useState('');
  async function run(operation: () => Promise<{ error?: string }>, message: string) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const result = await operation();
      if (result.error) throw new Error(result.error);
      toast.success(message); router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save. Please try again.';
      setError(message); toast.error(message);
    } finally { setBusy(false); }
  }
  async function createStudy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const demographicFilters: Record<string, string> = {};
    for (const key of ['industry', 'job_level', 'country']) {
      const value = String(data.get(key) ?? '').trim(); if (value) demographicFilters[key] = value;
    }
    await run(() => createNormStudyDefinition({ name: String(data.get('name')), assessmentId: String(data.get('assessment')), referencePopulation: String(data.get('population')), samplingPlan: String(data.get('samplingPlan')), minimumSampleSize: Number(data.get('minimumSampleSize')), demographicFilters }), 'Study definition saved');
  }
  const studyColumns: ColumnDef<Props['studies'][number]>[] = [
    { accessorKey: 'name', header: 'Study' },
    { accessorKey: 'population', header: 'Reference population' },
    { id: 'versions', header: 'Draft snapshots', cell: ({ row }) => row.original.versions.length ? row.original.versions.map(version => `n=${version.sampleSize}`).join(', ') : 'None yet' },
    { id: 'action', header: 'Action', cell: ({ row }) => <Button variant="outline" disabled={busy} onClick={() => run(() => createNormStudySnapshot(row.original.id), 'Draft snapshot saved for review')}>Create draft snapshot</Button> },
  ];
  const reviewColumns: ColumnDef<Props['reviewQueue'][number]>[] = [
    { accessorKey: 'participant', header: 'Participant' },
    { accessorKey: 'assessment', header: 'Instrument' },
    { accessorKey: 'campaign', header: 'Campaign' },
  ];
  return <section className="space-y-6">
    <Alert variant="info"><AlertDescription>Studies are draft descriptive snapshots for psychometric review. They do not publish population ranks or change participant scores. Sample size alone does not establish validity.</AlertDescription></Alert>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <form onSubmit={createStudy} className="rounded-lg border bg-card p-6 space-y-5">
      <h2 className="text-lg font-semibold">Define a reference population</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="study-name">Study name</Label><Input id="study-name" name="name" required maxLength={200} placeholder="Australian managers — development pilot" /></div>
        <div className="space-y-2"><Label htmlFor="study-assessment">Instrument</Label><select id="study-assessment" name="assessment" required className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="">Choose an assessment</option>{assessments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></div>
      </div>
      <div className="space-y-2"><Label htmlFor="study-population">Intended reference population</Label><Textarea id="study-population" name="population" required minLength={10} maxLength={2000} placeholder="Who should these data represent? Include geography, role and recruitment sources." /></div>
      <div className="grid gap-4 md:grid-cols-3">{['industry', 'job_level', 'country'].map(key => {
        const field = DEFAULT_DEMOGRAPHICS_CONFIG.fields.find(field => field.key === key)!;
        return <div className="space-y-2" key={key}><Label htmlFor={`study-${key}`}>{field.label} filter</Label><select id={`study-${key}`} name={key} className="w-full rounded-md border bg-background px-3 py-2 text-sm"><option value="">All recorded values</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
      })}</div>
      <div className="space-y-2"><Label htmlFor="study-plan">Sampling and review plan</Label><Textarea id="study-plan" name="samplingPlan" required minLength={10} maxLength={4000} placeholder="Document recruitment, exclusions, representativeness, required precision, subgroup analysis and who will review the evidence." /></div>
      <div className="space-y-2"><Label htmlFor="study-minimum">Minimum eligible administrations</Label><Input id="study-minimum" name="minimumSampleSize" type="number" min={2} max={100000} defaultValue={100} required /><p className="text-sm text-muted-foreground">An operational floor for this study. Choose it from the sampling plan; reaching it does not approve a norm.</p></div>
      <Button type="submit" disabled={busy || !assessments.length}>{busy ? 'Saving…' : 'Save study definition'}</Button>
    </form>
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Review real-data provenance</h2>
      <p className="text-sm text-muted-foreground">Only completed administrations with optional research permission enter this queue. Historical synthetic and preview data cannot be approved here. Verify that selected records came from real participants and document the evidence.</p>
      {reviewQueue.length ? <>
        <Label htmlFor="provenance-evidence">Evidence of real participant collection</Label>
        <Textarea id="provenance-evidence" value={sourceEvidence} onChange={event => setSourceEvidence(event.target.value)} maxLength={4000} />
        <DataTable columns={reviewColumns} data={reviewQueue} getRowId={row => row.id} enableRowSelection bulkActions={busy || sourceEvidence.trim().length < 20 ? [] : [{
          label: 'Confirm real participant provenance',
          action: (_ids, rows) => run(() => approveResearchObservations({ sessionIds: rows.map(row => row.id), sourceEvidence }), 'Provenance review recorded'),
        }]} />
      </> : <p className="text-sm text-muted-foreground">No eligible observations are waiting for review.</p>}
    </div>
    {studies.length > 0 && <DataTable columns={studyColumns} data={studies} getRowId={row => row.id} />}
  </section>;
}
