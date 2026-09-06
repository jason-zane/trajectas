"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getOutcomeRuns,
  createOutcomeStudy,
  saveOutcomeStudy,
  queueOutcomeRun,
  publishOutcomeReport,
  revokeOutcomeReport,
  saveOutcomeReportDraft,
} from "@/lib/dal/outcomes";
import { runNextOutcomeJob } from "@/lib/dal/outcome-jobs";
import { logActionError } from "@/lib/security/action-errors";
async function result<T>(work: () => Promise<T>) {
  try {
    return { data: await work() };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete this action.",
    };
  }
}
export async function createOutcomeStudyAction(input: unknown) {
  return result(async () => {
    const id = await createOutcomeStudy(input);
    revalidatePath("/business-outcomes");
    return id;
  });
}
export async function saveOutcomeStudyAction(
  id: string,
  revision: number,
  config: unknown,
) {
  return result(async () => {
    const next = await saveOutcomeStudy(id, revision, config);
    revalidatePath(`/business-outcomes/${id}`);
    return next;
  });
}
export async function runOutcomeStudyAction(id: string) {
  return result(async () => {
    const runId = await queueOutcomeRun(id);
    after(async () => {
      try {
        await runNextOutcomeJob(runId);
      } catch (error) {
        logActionError("outcomes.start", error);
      }
    });
    revalidatePath(`/business-outcomes/${id}`);
    return runId;
  });
}
export async function publishOutcomeReportAction(
  id: string,
  runId: string,
  draft: unknown,
) {
  return result(async () => {
    const reportId = await publishOutcomeReport(id, runId, draft);
    revalidatePath(`/business-outcomes/${id}`);
    return reportId;
  });
}
export async function revokeOutcomeReportAction(id: string, reportId: string) {
  return result(async () => {
    await revokeOutcomeReport(id, reportId);
    revalidatePath(`/business-outcomes/${id}`);
    return true;
  });
}
export async function saveOutcomeReportDraftAction(
  studyId: string,
  runId: string,
  revision: number,
  draft: unknown,
) {
  return result(async () => {
    const next = await saveOutcomeReportDraft(studyId, runId, revision, draft);
    revalidatePath(`/business-outcomes/${studyId}`);
    return next;
  });
}

export async function getOutcomeRunsAction(id: string) {
  return result(() => getOutcomeRuns(id));
}
