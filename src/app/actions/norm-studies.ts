'use server'

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdminScope, isUnconfinedPlatformAdmin, AuthorizationError } from '@/lib/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/auth/support-sessions';
import { prepareNormStudy, type NormObservation } from '@/lib/psychometrics/norm-study';

async function requireStudyAdmin() {
  const scope = await requireAdminScope();
  if (!isUnconfinedPlatformAdmin(scope) || !scope.actor) throw new AuthorizationError('Norm studies require the platform workspace.');
  return scope.actor;
}
const definitionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  assessmentId: z.string().uuid(),
  referencePopulation: z.string().trim().min(10).max(2000),
  samplingPlan: z.string().trim().min(10).max(4000),
  demographicFilters: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/).max(64), z.string().trim().min(1).max(500)).default({}),
  minimumSampleSize: z.number().int().min(2).max(100000),
});
export async function createNormStudyDefinition(input: z.input<typeof definitionSchema>) {
  const actor = await requireStudyAdmin();
  const parsed = definitionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Provide a name, instrument, population, sampling plan and sample floor.' };
  const db = createAdminClient();
  const { data: instrument, error: instrumentError } = await db.from('assessments').select('scoring_profile').eq('id', parsed.data.assessmentId).is('deleted_at', null).single();
  if (instrumentError || instrument?.scoring_profile !== 'pomp_factor') return { error: 'Choose a POMP self-report instrument.' };
  const group = await db.from('norm_groups').insert({ name: parsed.data.name, description: parsed.data.referencePopulation, sample_size: 0 }).select('id').single();
  if (group.error || !group.data) return { error: 'Unable to create the reference group.' };
  const definition = await db.from('norm_cohort_definitions').insert({
    norm_group_id: group.data.id, assessment_id: parsed.data.assessmentId,
    reference_population: parsed.data.referencePopulation, sampling_plan: parsed.data.samplingPlan,
    demographic_filters: parsed.data.demographicFilters, minimum_sample_size: parsed.data.minimumSampleSize,
    created_by: actor.id,
  }).select('id').single();
  if (definition.error || !definition.data) {
    await db.from('norm_groups').delete().eq('id', group.data.id);
    return { error: 'Unable to save the study definition.' };
  }
  await logAuditEvent({ actorProfileId: actor.id, eventType: 'norm_study.defined', targetTable: 'norm_cohort_definitions', targetId: definition.data.id });
  revalidatePath('/psychometrics/norms');
  return { id: String(definition.data.id) };
}

export async function getNormStudyDefinitions() {
  await requireStudyAdmin();
  const { data, error } = await createAdminClient().from('norm_cohort_definitions').select('id, reference_population, minimum_sample_size, norm_groups(name), norm_versions(id, sample_size, created_at)').order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load norm studies. Apply the readiness migration first.');
  return (data ?? []).map(row => {
    const group = Array.isArray(row.norm_groups) ? row.norm_groups[0] : row.norm_groups;
    return { id: String(row.id), name: String(group?.name ?? 'Study'), population: String(row.reference_population), minimumSampleSize: Number(row.minimum_sample_size), versions: (row.norm_versions ?? []).map((version: { id: string; sample_size: number; created_at: string }) => ({ id: version.id, sampleSize: version.sample_size, createdAt: version.created_at })) };
  });
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** No participant names, emails, tokens or mutable raw data are saved in a norm snapshot. */
export async function createNormStudySnapshot(cohortId: string) {
  const actor = await requireStudyAdmin();
  if (!z.string().uuid().safeParse(cohortId).success) return { error: 'Choose a study.' };
  const db = createAdminClient();
  const { data: definition, error } = await db.from('norm_cohort_definitions').select('*').eq('id', cohortId).single();
  if (error || !definition) return { error: 'Study not found.' };
  const factors = await db.from('assessment_factors').select('factor_id').eq('assessment_id', definition.assessment_id);
  if (factors.error) return { error: 'Unable to verify instrument coverage.' };
  const observations: NormObservation[] = [];
  const filters = definition.demographic_filters as Record<string, string>;
  // Whole administrations, with a stable ordering and bounded pages. Never use
  // includeInternal to admit test data into an empirical study.
  for (let offset = 0; ; offset += 50) {
    const result = await db.from('participant_sessions').select(`id, completed_at,
      campaign_participants!inner(email, demographics, research_use_permitted, status, deleted_at),
      campaigns!inner(is_internal, deleted_at), participant_scores(factor_id, scaled_score, metric, provisional),
      participant_section_forms(entries), participant_responses(item_id)`)
      .eq('assessment_id', definition.assessment_id).eq('status', 'completed').eq('observation_origin', 'real')
      .eq('is_internal', false).eq('campaigns.is_internal', false).is('campaigns.deleted_at', null)
      .eq('campaign_participants.research_use_permitted', true).is('campaign_participants.deleted_at', null)
      .not('campaign_participants.status', 'in', '(withdrawn,expired)')
      .order('id').range(offset, offset + 49);
    if (result.error) return { error: 'Unable to load eligible study observations.' };
    for (const row of result.data ?? []) {
      const participant = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants;
      if (!participant || !participant.email || !row.completed_at) continue;
      const demographics = participant.demographics as Record<string, string> | null;
      if (Object.entries(filters).some(([key, value]) => demographics?.[key] !== value)) continue;
      type Entry = { itemId: string; itemVersion: number; contentHash: string; countsTowardScore: boolean; purpose: string };
      const entries = (row.participant_section_forms ?? []).flatMap((form: { entries: Entry[] }) => form.entries ?? []).filter((entry: Entry) => entry.countsTowardScore === true).sort((a: Entry, b: Entry) => a.itemId.localeCompare(b.itemId));
      const answered = new Set((row.participant_responses ?? []).map((response: { item_id: string }) => response.item_id));
      if (!entries.length || entries.some((entry: Entry) => !answered.has(entry.itemId))) continue;
      const scores: Record<string, number> = {};
      for (const score of row.participant_scores ?? []) if (score.metric === 'pomp' && score.provisional !== true) scores[score.factor_id] = Number(score.scaled_score);
      observations.push({ sessionId: String(row.id), personKey: hash(String(participant.email).trim().toLowerCase()), completedAt: String(row.completed_at), formHash: hash(entries.map((entry: Entry) => ({ itemId: entry.itemId, itemVersion: entry.itemVersion, contentHash: entry.contentHash, purpose: entry.purpose }))), scores });
    }
    if ((result.data?.length ?? 0) < 50) break;
  }
  try {
    const study = prepareNormStudy(observations, (factors.data ?? []).map(row => String(row.factor_id)), Number(definition.minimum_sample_size));
    const snapshot = await db.from('norm_versions').insert({
      cohort_definition_id: cohortId, assessment_id: definition.assessment_id, scorer_version: 'ctt-pomp-v1',
      form_hash: study.formHash, cohort_manifest_hash: hash(study.included.map(row => ({ session: hash(row.sessionId), scores: row.scores }))),
      reference_population: definition.reference_population, sample_size: study.included.length,
      distributions: study.distributions, created_by: actor.id,
      cohort_definition_snapshot: { ...definition, repeatPolicy: 'first_complete_per_normalised_email', excludedIncomplete: study.excludedIncomplete, excludedRepeats: study.excludedRepeats, intendedUse: 'development_coaching', status: 'draft_for_psychometric_review' },
    }).select('id').single();
    if (snapshot.error || !snapshot.data) return { error: 'Unable to save the immutable study snapshot.' };
    await logAuditEvent({ actorProfileId: actor.id, eventType: 'norm_study.snapshotted', targetTable: 'norm_versions', targetId: snapshot.data.id, metadata: { sampleSize: study.included.length, cohortId } });
    revalidatePath('/psychometrics/norms');
    return { id: String(snapshot.data.id) };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to prepare this study.' }; }
}

/** Human provenance review is separate from automatic test/internal flags. */
export async function approveResearchObservations(input: { sessionIds: string[]; sourceEvidence: string }) {
  const actor = await requireStudyAdmin();
  const parsed = z.object({ sessionIds: z.array(z.string().uuid()).min(1).max(100), sourceEvidence: z.string().trim().min(20).max(4000) }).safeParse(input);
  if (!parsed.success) return { error: 'Select observations and document how real participant provenance was verified.' };
  const db = createAdminClient();
  const result = await db.from('participant_sessions').select('id, observation_origin, is_internal, campaign_participants!inner(research_use_permitted, status, deleted_at), campaigns!inner(is_internal, deleted_at)').in('id', parsed.data.sessionIds).eq('status', 'completed').eq('observation_origin', 'unknown').eq('is_internal', false).eq('campaigns.is_internal', false).eq('campaign_participants.research_use_permitted', true).is('campaign_participants.deleted_at', null).not('campaign_participants.status', 'in', '(withdrawn,expired)').is('campaigns.deleted_at', null);
  if (result.error || result.data?.length !== new Set(parsed.data.sessionIds).size) return { error: 'Only complete, non-test, unknown-origin observations with recorded research permission may be approved.' };
  const saved = await db.from('participant_sessions').update({ observation_origin: 'real', observation_origin_review: { reviewedBy: actor.id, reviewedAt: new Date().toISOString(), sourceEvidence: parsed.data.sourceEvidence } }).in('id', parsed.data.sessionIds).eq('observation_origin', 'unknown').select('id');
  if (saved.error || saved.data?.length !== result.data.length) return { error: 'Unable to record provenance review.' };
  await logAuditEvent({ actorProfileId: actor.id, eventType: 'research_observations.approved', targetTable: 'participant_sessions', metadata: { sessionIds: parsed.data.sessionIds, sourceEvidence: parsed.data.sourceEvidence } });
  revalidatePath('/psychometrics/norms');
  return { approved: result.data.length };
}

export async function getResearchObservationReviewQueue() {
  await requireStudyAdmin();
  const { data, error } = await createAdminClient().from('participant_sessions')
    .select('id, completed_at, assessments(title), campaign_participants!inner(first_name, last_name, research_use_permitted, status, deleted_at), campaigns!inner(title, is_internal, deleted_at)')
    .eq('status', 'completed').eq('observation_origin', 'unknown').eq('is_internal', false)
    .eq('campaigns.is_internal', false).is('campaigns.deleted_at', null)
    .eq('campaign_participants.research_use_permitted', true).is('campaign_participants.deleted_at', null)
    .not('campaign_participants.status', 'in', '(withdrawn,expired)')
    .order('completed_at', { ascending: false }).limit(100);
  if (error) throw new Error('Unable to load the provenance review queue.');
  return (data ?? []).map(row => {
    const participant = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants;
    const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
    const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
    return { id: String(row.id), participant: [participant?.first_name, participant?.last_name].filter(Boolean).join(' ') || 'Participant', assessment: String(assessment?.title ?? 'Assessment'), campaign: String(campaign?.title ?? 'Campaign'), completedAt: String(row.completed_at) };
  });
}
