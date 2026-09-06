import "server-only";
import { createHash, randomUUID } from "node:crypto";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  requireAdminScope,
  resolveAuthorizedScope,
  requireClientAccess,
  resolveTenantClientFilter,
  AuthorizationError,
} from "@/lib/auth/authorization";
import { logActionError } from "@/lib/security/action-errors";
import { logAuditEvent } from "@/lib/auth/support-sessions";
import {
  EMPTY_OUTCOME_CONFIG,
  type OutcomeReportDraft,
  type OutcomeConfig,
  type OutcomeImport,
  type OutcomeReport,
  type OutcomeReportPayload,
  type OutcomeRun,
  type OutcomeStudy,
} from "@/lib/outcomes/types";
import {
  outcomeConfigSchema,
  reportDraftSchema,
  studyCreateSchema,
} from "@/lib/outcomes/validation";
import {
  prepareOutcomeInput,
  predictorFor,
  type SourcePerson,
  type SourceScore,
  type SourceSession,
} from "@/lib/outcomes/prepare";
import { outcomeInputHash } from "@/lib/outcomes/snapshot";
import {
  validateOutcomeReport,
  redactSmallOutcomeCells,
} from "@/lib/outcomes/report";

async function scopeForClient(clientId?: string) {
  const scope = await requireAdminScope();
  const allowed = resolveTenantClientFilter(scope);
  if (clientId && allowed !== null && !allowed.includes(clientId))
    throw new AuthorizationError(
      "This client is outside the active workspace.",
    );
  return scope;
}
function checked(error: unknown, message: string): void {
  if (error) {
    logActionError("outcomes.database", error);
    throw new Error(message);
  }
}
interface StudyRecord {
  id: string;
  client_id: string;
  title: string;
  question: string;
  config: OutcomeConfig;
  revision: number;
  created_at: string;
  clients: { name: string } | null;
}
const studyColumns =
  "id,client_id,title,question,config,revision,created_at,clients(name)";
function toStudy(row: StudyRecord): OutcomeStudy {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "Client",
    title: row.title,
    question: row.question,
    config: outcomeConfigSchema.safeParse(row.config).success
      ? row.config
      : EMPTY_OUTCOME_CONFIG,
    revision: row.revision,
    createdAt: row.created_at,
  };
}
async function studyAccess(id: string) {
  const initialScope = await scopeForClient(),
    allowed = resolveTenantClientFilter(initialScope);
  let query = createAdminClient()
    .from("outcome_studies")
    .select(studyColumns)
    .eq("id", id)
    .is("deleted_at", null);
  if (allowed !== null) query = query.in("client_id", allowed);
  const { data, error } = await query.single();
  checked(error, "Study not found or inaccessible.");
  const row = data as unknown as StudyRecord;
  const scope = await scopeForClient(row.client_id);
  return { study: toStudy(row), scope };
}
export async function listOutcomeStudies() {
  const scope = await scopeForClient(),
    allowed = resolveTenantClientFilter(scope),
    db = createAdminClient();
  let query = db
    .from("outcome_studies")
    .select(studyColumns)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(250);
  let clientsQuery = db
    .from("clients")
    .select("id,name")
    .is("deleted_at", null)
    .order("name")
    .limit(500);
  if (allowed !== null) {
    query = query.in("client_id", allowed);
    clientsQuery = clientsQuery.in("id", allowed);
  }
  const [studies, clients] = await Promise.all([query, clientsQuery]);
  checked(studies.error, "Unable to load studies.");
  checked(clients.error, "Unable to load clients.");
  return {
    studies: (studies.data as unknown as StudyRecord[]).map(toStudy),
    clients: clients.data as { id: string; name: string }[],
  };
}
export async function createOutcomeStudy(input: unknown) {
  const parsed = studyCreateSchema.parse(input),
    scope = await scopeForClient(parsed.clientId);
  await requireClientAccess(parsed.clientId);
  if (!scope.actor) throw new AuthorizationError("Sign in to create a study.");
  const { data, error } = await createAdminClient()
    .from("outcome_studies")
    .insert({
      client_id: parsed.clientId,
      title: parsed.title,
      question: parsed.question,
      config: EMPTY_OUTCOME_CONFIG,
      created_by: scope.actor.id,
    })
    .select("id")
    .single();
  checked(error, "Unable to create study.");
  await logAuditEvent({
    actorProfileId: scope.actor.id,
    eventType: "outcome_study_created",
    targetTable: "outcome_studies",
    targetId: data!.id,
    clientId: parsed.clientId,
  });
  return data!.id as string;
}
export async function saveOutcomeStudy(
  id: string,
  revision: number,
  input: unknown,
) {
  const { study } = await studyAccess(id),
    config = outcomeConfigSchema.parse(input);
  const { campaigns } = await outcomeSources(study.clientId, []);
  if (config.campaignIds.some((id) => !campaigns.some((c) => c.id === id)))
    throw new Error(
      "Select active, identifiable campaigns belonging to this client.",
    );
  if (config.importId) {
    const { data } = await createAdminClient()
      .from("outcome_imports")
      .select("id")
      .eq("id", config.importId)
      .eq("study_id", id)
      .eq("client_id", study.clientId)
      .maybeSingle();
    if (!data) throw new Error("The import does not belong to this study.");
  }
  const { data, error } = await createAdminClient()
    .from("outcome_studies")
    .update({
      config,
      revision: revision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("revision", revision)
    .select("revision")
    .maybeSingle();
  checked(error, "Unable to save study.");
  if (!data)
    throw new Error(
      "Another consultant changed this study. Refresh before saving.",
    );
  return data.revision as number;
}
async function collect<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  limit = 10000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= limit; from += 1000) {
    const result = await query(from, from + 999);
    checked(result.error, "Unable to load assessment sources.");
    const page = result.data as T[];
    rows.push(...page);
    if (rows.length > limit)
      throw new Error("Too many assessment sources. Select fewer campaigns.");
    if (page.length < 1000) break;
  }
  return rows;
}
async function outcomeSources(clientId: string, campaignIds: string[]) {
  const db = createAdminClient();
  const campaignResult = await db
    .from("campaigns")
    .select("id,title")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .eq("is_internal", false)
    .eq("confidentiality_mode", "standard")
    .order("created_at", { ascending: false })
    .limit(500);
  checked(campaignResult.error, "Unable to load campaigns.");
  const campaigns = campaignResult.data as { id: string; title: string }[];
  if (campaignIds.some((id) => !campaigns.some((c) => c.id === id)))
    throw new Error(
      "A selected campaign is unavailable or does not permit identifiable outcomes analysis.",
    );
  if (!campaignIds.length)
    return {
      campaigns,
      sessions: [] as SourceSession[],
      people: [] as SourcePerson[],
      scores: [] as SourceScore[],
      predictors: [],
    };
  const [sessions, people] = await Promise.all([
    collect<SourceSession>((a, b) =>
      db
        .from("participant_sessions")
        .select(
          "id,campaign_id,campaign_participant_id,assessment_id,completed_at,assessments(title)",
        )
        .eq("client_id", clientId)
        .in("campaign_id", campaignIds)
        .eq("status", "completed")
        .eq("processing_status", "ready")
        .eq("is_internal", false)
        .not("completed_at", "is", null)
        .order("id")
        .range(a, b),
    ),
    collect<SourcePerson>((a, b) =>
      db
        .from("campaign_participants")
        .select("id,person_key,email,campaign_id")
        .in("campaign_id", campaignIds)
        .is("deleted_at", null)
        .is("campaign_rater_id", null)
        .not("person_key", "is", null)
        .order("id")
        .range(a, b),
    ),
  ]);
  const scores: SourceScore[] = [];
  for (let i = 0; i < sessions.length; i += 100) {
    scores.push(
      ...(await collect<SourceScore>((a, b) =>
        db
          .from("participant_scores")
          .select(
            "session_id,factor_id,scaled_score,scoring_method,metric,scoring_variant,parameter_scale_code,norm_version,norm_group_id,factors(name)",
          )
          .in(
            "session_id",
            sessions.slice(i, i + 100).map((s) => s.id),
          )
          .not("scaled_score", "is", null)
          .or("provisional.is.null,provisional.eq.false")
          .order("id")
          .range(a, b),
      )),
    );
  }
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const predictors = [
    ...new Map(
      scores.map((s) => {
        const p = predictorFor(s, sessionMap.get(s.session_id)!);
        return [p.id, p];
      }),
    ).values(),
  ].sort(
    (a, b) =>
      a.assessment.localeCompare(b.assessment) ||
      a.label.localeCompare(b.label),
  );
  return { campaigns, sessions, people, scores, predictors };
}
interface ImportRecord {
  id: string;
  filename: string;
  headers: string[];
  preview: string[][];
  row_count: number;
  created_at: string;
  checksum: string;
}
function toImport(r: ImportRecord): OutcomeImport {
  return {
    id: r.id,
    filename: r.filename,
    headers: r.headers,
    preview: r.preview,
    rowCount: r.row_count,
    createdAt: r.created_at,
  };
}
interface RunRecord {
  id: string;
  created_at: string;
  status: OutcomeRun["status"];
  error: string | null;
  result: OutcomeRun["result"];
  input_summary: OutcomeRun["input"];
}
function toRun(r: RunRecord): OutcomeRun {
  return {
    id: r.id,
    createdAt: r.created_at,
    status: r.status,
    error: r.error,
    result: r.result,
    input: r.input_summary,
  };
}
export async function getOutcomeRuns(id: string) {
  const { study } = await studyAccess(id);
  const result = await createAdminClient()
    .from("outcome_runs")
    .select("id,created_at,status,error,result,input_summary")
    .eq("study_id", id)
    .eq("client_id", study.clientId)
    .order("created_at", { ascending: false })
    .limit(12);
  checked(result.error, "Unable to refresh the analyses.");
  return (result.data as RunRecord[]).map(toRun);
}
export async function getOutcomeWorkspace(id: string) {
  const { study } = await studyAccess(id),
    db = createAdminClient();
  const [source, imports, runs, reports, drafts] = await Promise.all([
    outcomeSources(study.clientId, study.config.campaignIds),
    db
      .from("outcome_imports")
      .select("id,filename,headers,preview,row_count,created_at,checksum")
      .eq("study_id", id)
      .eq("client_id", study.clientId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("outcome_runs")
      .select("id,created_at,status,error,result,input_summary")
      .eq("study_id", id)
      .eq("client_id", study.clientId)
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .from("outcome_reports")
      .select("id,title,created_at,revoked_at")
      .eq("study_id", id)
      .eq("client_id", study.clientId)
      .order("created_at", { ascending: false })
      .limit(25),
    db
      .from("outcome_report_drafts")
      .select("run_id,draft,revision")
      .eq("study_id", id)
      .eq("client_id", study.clientId),
  ]);
  for (const r of [imports, runs, reports, drafts])
    checked(r.error, "Unable to load the study workspace.");
  return {
    drafts: (drafts.data ?? []).map((d) => ({
      runId: d.run_id as string,
      draft: d.draft as OutcomeReportDraft,
      revision: d.revision as number,
    })),
    study,
    campaigns: source.campaigns,
    predictors: source.predictors,
    imports: (imports.data as ImportRecord[]).map(toImport),
    runs: (runs.data as RunRecord[]).map(toRun),
    reports: (reports.data ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      createdAt: r.created_at as string,
      revokedAt: r.revoked_at as string | null,
    })),
  };
}
export async function importOutcomeData(
  studyId: string,
  file: File,
  sheet: string,
) {
  const { study, scope } = await studyAccess(studyId);
  if (!scope.actor) throw new AuthorizationError("Sign in to import data.");
  if (file.size < 1 || file.size > 4 * 1024 * 1024)
    throw new Error("Upload a CSV or XLSX file up to 4 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "xlsx"].includes(extension ?? ""))
    throw new Error("Use CSV or XLSX format.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256")
      .update(buffer)
      .update("\n" + sheet)
      .digest("hex"),
    db = createAdminClient();
  const existing = await db
    .from("outcome_imports")
    .select("id,filename,headers,preview,row_count,created_at,checksum")
    .eq("study_id", studyId)
    .eq("checksum", checksum)
    .maybeSingle();
  checked(existing.error, "Unable to check previous imports.");
  if (existing.data) return toImport(existing.data as ImportRecord);
  let grid: string[][];
  if (extension === "csv") {
    const parsed = Papa.parse<string[]>(
      buffer.toString("utf8").replace(/^\uFEFF/, ""),
      { skipEmptyLines: "greedy" },
    );
    if (parsed.errors.length)
      throw new Error(
        "The CSV has malformed rows or quoting. Correct the file and upload again.",
      );
    grid = parsed.data;
  } else {
    const values = await readSheet(buffer, sheet || 1);
    grid = values
      .map((row) =>
        row.map((v) =>
          v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""),
        ),
      )
      .filter((row) => row.some((v) => v.trim()));
  }
  const headers = (grid.shift() ?? []).map((h) => h.trim());
  if (
    headers.length < 2 ||
    headers.length > 100 ||
    headers.some((h) => !h || h.length > 150) ||
    new Set(headers).size !== headers.length
  )
    throw new Error(
      "Use 2–100 unique, non-empty column headings, each under 150 characters.",
    );
  if (!grid.length || grid.length > 5000)
    throw new Error("An import must contain 1–5,000 business rows.");
  if (
    grid.some(
      (row) =>
        row.length > headers.length || row.some((cell) => cell.length > 2000),
    )
  )
    throw new Error(
      "A row has too many columns or a cell exceeds 2,000 characters.",
    );
  grid = grid.map((row) => headers.map((_, i) => row[i] ?? ""));
  const id = randomUUID(),
    path = `${study.clientId}/${studyId}/${id}.${extension}`;
  const upload = await db.storage.from("outcome-sources").upload(path, buffer, {
    contentType:
      extension === "csv"
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: false,
  });
  checked(upload.error, "Unable to store the original source file.");
  const { data, error } = await db
    .from("outcome_imports")
    .insert({
      id,
      study_id: studyId,
      client_id: study.clientId,
      filename: file.name.slice(0, 180),
      checksum,
      storage_path: path,
      headers,
      rows: grid,
      row_count: grid.length,
      created_by: scope.actor.id,
    })
    .select("id,filename,headers,preview,row_count,created_at,checksum")
    .single();
  if (error) {
    await db.storage.from("outcome-sources").remove([path]);
    checked(error, "Unable to record import. Try again.");
  }
  await logAuditEvent({
    actorProfileId: scope.actor.id,
    eventType: "outcome_data_imported",
    targetTable: "outcome_imports",
    targetId: id,
    clientId: study.clientId,
    metadata: { rowCount: grid.length, checksum },
  });
  return toImport(data as ImportRecord);
}
export async function getOutcomeRoster(studyId: string) {
  const { study } = await studyAccess(studyId);
  const source = await outcomeSources(study.clientId, study.config.campaignIds);
  return [
    ...new Map(
      source.people.map((p) => [
        p.person_key,
        { personKey: p.person_key, email: p.email },
      ]),
    ).values(),
  ];
}
export async function queueOutcomeRun(studyId: string) {
  const { study, scope } = await studyAccess(studyId);
  if (!scope.actor) throw new AuthorizationError("Sign in to run an analysis.");
  if (!study.config.importId || !study.config.campaignIds.length)
    throw new Error("Save an import and at least one campaign before running.");
  if (!process.env.CRON_SECRET)
    throw new Error("The statistical worker is not configured.");
  const db = createAdminClient();
  const active = await db
    .from("outcome_runs")
    .select("id")
    .eq("study_id", studyId)
    .in("status", ["queued", "running"])
    .limit(1);
  checked(active.error, "Unable to check running analyses.");
  if (active.data?.length)
    throw new Error("This study already has an analysis in progress.");
  const source = await outcomeSources(study.clientId, study.config.campaignIds);
  const imported = await db
    .from("outcome_imports")
    .select("id,filename,headers,rows,row_count,created_at,checksum")
    .eq("id", study.config.importId)
    .eq("study_id", studyId)
    .eq("client_id", study.clientId)
    .single();
  checked(imported.error, "The selected import is unavailable.");
  const raw = imported.data as unknown as ImportRecord & { rows: string[][] };
  const input = prepareOutcomeInput({
    config: study.config,
    headers: raw.headers,
    records: raw.rows,
    ...source,
    source: {
      checksum: raw.checksum,
      filename: raw.filename,
      extractedAt: new Date().toISOString(),
      formVersions: [],
    },
  });
  const formVersions = new Set<string>();
  for (let i = 0; i < source.sessions.length; i += 100) {
    const forms = await collect<{
      assembler_version: string;
      authoring_revision: string | null;
    }>((a, b) =>
      db
        .from("participant_section_forms")
        .select("assembler_version,authoring_revision")
        .in(
          "session_id",
          source.sessions.slice(i, i + 100).map((s) => s.id),
        )
        .order("id")
        .range(a, b),
    );
    for (const f of forms)
      formVersions.add(
        `${f.assembler_version}:${f.authoring_revision ?? "legacy-unknown"}`,
      );
  }
  input.source.formVersions = [...formVersions].sort();
  const body = JSON.stringify(input);
  if (Buffer.byteLength(body) > 4_000_000)
    throw new Error(
      "The analysis exceeds the worker size limit. Select fewer columns or people.",
    );
  const { data, error } = await db
    .from("outcome_runs")
    .insert({
      study_id: studyId,
      client_id: study.clientId,
      import_id: study.config.importId,
      input,
      input_hash: outcomeInputHash(input),
      created_by: scope.actor.id,
    })
    .select("id")
    .single();
  checked(error, "Unable to queue the analysis.");
  await logAuditEvent({
    actorProfileId: scope.actor.id,
    eventType: "outcome_analysis_queued",
    targetTable: "outcome_runs",
    targetId: data!.id,
    clientId: study.clientId,
    metadata: { people: input.rows.length },
  });
  return data!.id as string;
}
export async function publishOutcomeReport(
  studyId: string,
  runId: string,
  draftInput: unknown,
) {
  const { study, scope } = await studyAccess(studyId),
    draft = reportDraftSchema.parse(draftInput);
  if (!scope.actor)
    throw new AuthorizationError("Sign in to publish a report.");
  const { data, error } = await createAdminClient()
    .from("outcome_runs")
    .select("id,created_at,status,error,result,input_summary")
    .eq("id", runId)
    .eq("study_id", studyId)
    .eq("client_id", study.clientId)
    .eq("status", "completed")
    .single();
  checked(error, "Select a completed analysis from this study.");
  const run = toRun(data as RunRecord);
  const payload: OutcomeReportPayload = {
    version: 1,
    study: {
      title: study.title,
      question: study.question,
      clientName: study.clientName,
    },
    draft,
    config: run.input.config,
    predictors: run.input.predictors,
    quality: run.input.quality,
    source: run.input.source,
    result: run.result!,
    runId,
    runCreatedAt: run.createdAt,
  };
  validateOutcomeReport(payload);
  const published = await createAdminClient()
    .from("outcome_reports")
    .insert({
      study_id: studyId,
      client_id: study.clientId,
      run_id: runId,
      title: draft.headline,
      payload: redactSmallOutcomeCells(payload),
      published_by: scope.actor.id,
    })
    .select("id")
    .single();
  checked(published.error, "Unable to publish report.");
  await logAuditEvent({
    actorProfileId: scope.actor.id,
    eventType: "outcome_report_published",
    targetTable: "outcome_reports",
    targetId: published.data!.id,
    clientId: study.clientId,
  });
  return published.data!.id as string;
}
export async function getOutcomeReport(id: string): Promise<OutcomeReport> {
  const initialScope = await resolveAuthorizedScope(),
    allowedClients = resolveTenantClientFilter(initialScope);
  const db = await createClient();
  let query = db
    .from("outcome_reports")
    .select("id,client_id,title,created_at,revoked_at,payload")
    .eq("id", id)
    .is("revoked_at", null);
  if (allowedClients !== null) query = query.in("client_id", allowedClients);
  const { data, error } = await query.single();
  if (error || !data)
    throw new AuthorizationError("Report not found or inaccessible.");
  const { scope } = await requireClientAccess(data.client_id);
  const allowed = resolveTenantClientFilter(scope);
  if (allowed !== null && !allowed.includes(data.client_id))
    throw new AuthorizationError("Report is outside the active workspace.");
  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
    revokedAt: data.revoked_at,
    payload: data.payload as OutcomeReportPayload,
  };
}
export async function revokeOutcomeReport(studyId: string, reportId: string) {
  const { study, scope } = await studyAccess(studyId);
  const { error } = await createAdminClient()
    .from("outcome_reports")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("study_id", studyId)
    .eq("client_id", study.clientId)
    .is("revoked_at", null);
  checked(error, "Unable to revoke report.");
  if (scope.actor)
    await logAuditEvent({
      actorProfileId: scope.actor.id,
      eventType: "outcome_report_revoked",
      targetTable: "outcome_reports",
      targetId: reportId,
      clientId: study.clientId,
    });
}
export async function saveOutcomeReportDraft(
  studyId: string,
  runId: string,
  revision: number,
  input: unknown,
) {
  const { study, scope } = await studyAccess(studyId),
    draft = reportDraftSchema.parse(input),
    db = createAdminClient();
  if (!scope.actor)
    throw new AuthorizationError("Sign in to save a report draft.");
  const run = await db
    .from("outcome_runs")
    .select("id")
    .eq("id", runId)
    .eq("study_id", studyId)
    .eq("client_id", study.clientId)
    .eq("status", "completed")
    .maybeSingle();
  checked(run.error, "Unable to load the analysis.");
  if (!run.data) throw new Error("A completed analysis is required.");
  const fields = {
    draft,
    revision: revision + 1,
    updated_by: scope.actor.id,
    updated_at: new Date().toISOString(),
  };
  const result =
    revision === 0
      ? await db
          .from("outcome_report_drafts")
          .insert({
            ...fields,
            run_id: runId,
            study_id: studyId,
            client_id: study.clientId,
          })
          .select("revision")
          .single()
      : await db
          .from("outcome_report_drafts")
          .update(fields)
          .eq("run_id", runId)
          .eq("study_id", studyId)
          .eq("client_id", study.clientId)
          .eq("revision", revision)
          .select("revision")
          .maybeSingle();
  if (result.error || !result.data)
    throw new Error(
      "The draft changed elsewhere or could not be saved. Refresh before editing it again.",
    );
  return result.data.revision as number;
}
