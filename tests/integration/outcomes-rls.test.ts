import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";

describe.skipIf(!canRun)(
  "Business Outcomes access and snapshot integrity",
  () => {
    const db = createAdminClient(),
      a = randomUUID(),
      b = randomUUID(),
      study = randomUUID(),
      source = randomUUID(),
      run = randomUUID(),
      report = randomUUID();
    let actor: Awaited<ReturnType<typeof createTestUser>>,
      clientA: Awaited<ReturnType<typeof createTestUser>>,
      clientB: Awaited<ReturnType<typeof createTestUser>>;
    const extraStudies: string[] = [];
    async function insert(
      table: string,
      record: Record<string, unknown> | Record<string, unknown>[],
    ) {
      const result = await db.from(table).insert(record);
      if (result.error) throw new Error(`${table}: ${result.error.message}`);
    }
    beforeAll(async () => {
      await insert("clients", [
        { id: a, name: "Outcomes local A", slug: a },
        { id: b, name: "Outcomes local B", slug: b },
      ]);
      actor = await createTestUser(db, {
        email: `outcomes-admin-${study}@test.local`,
        role: "platform_admin",
      });
      clientA = await createTestUser(db, {
        email: `outcomes-a-${study}@test.local`,
        role: "org_admin",
        clientId: a,
      });
      clientB = await createTestUser(db, {
        email: `outcomes-b-${study}@test.local`,
        role: "org_admin",
        clientId: b,
      });
      await insert("client_memberships", [
        { profile_id: clientA.userId, client_id: a, role: "admin" },
        { profile_id: clientB.userId, client_id: b, role: "admin" },
      ]);
      await insert("outcome_studies", {
        id: study,
        client_id: a,
        title: "Local study",
        created_by: actor.userId,
      });
      await insert("outcome_imports", {
        id: source,
        study_id: study,
        client_id: a,
        filename: "local.csv",
        checksum: source,
        storage_path: "local-test",
        headers: ["id", "kpi"],
        rows: [["person", "12"]],
        row_count: 1,
        created_by: actor.userId,
      });
      await insert("outcome_runs", {
        id: run,
        study_id: study,
        client_id: a,
        import_id: source,
        input: { frozen: true },
        input_hash: run,
        created_by: actor.userId,
      });
      const finished = await db
        .from("outcome_runs")
        .update({
          status: "completed",
          result: { aggregate: true },
          completed_at: new Date().toISOString(),
        })
        .eq("id", run);
      expect(finished.error).toBeNull();
      await insert("outcome_reports", {
        id: report,
        study_id: study,
        client_id: a,
        run_id: run,
        title: "Local report",
        payload: { aggregate: true },
        published_by: actor.userId,
      });
    });
    afterAll(async () => {
      await db.from("outcome_reports").delete().eq("id", report);
      await db.from("outcome_report_drafts").delete().eq("study_id", study);
      await db
        .from("outcome_runs")
        .delete()
        .in("study_id", [study, ...extraStudies]);
      await db
        .from("outcome_imports")
        .delete()
        .in("study_id", [study, ...extraStudies]);
      await db
        .from("outcome_studies")
        .delete()
        .in("id", [study, ...extraStudies]);
      for (const user of [actor, clientA, clientB])
        if (user) {
          await db
            .from("client_memberships")
            .delete()
            .eq("profile_id", user.userId);
          await db.from("profiles").delete().eq("id", user.userId);
          await db.auth.admin.deleteUser(user.userId);
        }
      await db.from("clients").delete().in("id", [a, b]);
    });
    it("allows internal analysis reads while hiding raw data from clients", async () => {
      for (const table of [
        "outcome_studies",
        "outcome_imports",
        "outcome_runs",
      ]) {
        const internal = await actor.client
          .from(table)
          .select("id")
          .eq(table === "outcome_studies" ? "id" : "study_id", study);
        expect(internal.error).toBeNull();
        expect(internal.data).toHaveLength(1);
        for (const viewer of [clientA, clientB]) {
          const rows = await viewer.client.from(table).select("id");
          expect(rows.error).toBeNull();
          expect(rows.data).toEqual([]);
        }
      }
    });
    it("exposes a published report only to its client and platform admin", async () => {
      expect(
        (
          await clientA.client
            .from("outcome_reports")
            .select("id")
            .eq("id", report)
        ).data,
      ).toEqual([{ id: report }]);
      expect(
        (
          await clientB.client
            .from("outcome_reports")
            .select("id")
            .eq("id", report)
        ).data,
      ).toEqual([]);
    });
    it("blocks deactivated accounts, including platform admins", async () => {
      for (const viewer of [actor, clientA]) {
        expect(
          (
            await db
              .from("profiles")
              .update({ is_active: false })
              .eq("id", viewer.userId)
          ).error,
        ).toBeNull();
        try {
          expect(
            (
              await viewer.client
                .from("outcome_reports")
                .select("id")
                .eq("id", report)
            ).data,
          ).toEqual([]);
          expect(
            (
              await viewer.client
                .from("outcome_studies")
                .select("id")
                .eq("id", study)
            ).data,
          ).toEqual([]);
        } finally {
          await db
            .from("profiles")
            .update({ is_active: true })
            .eq("id", viewer.userId);
        }
      }
    });
    it("keeps generated previews separate from the full snapshot", async () => {
      const imported = await db
        .from("outcome_imports")
        .select("preview")
        .eq("id", source)
        .single();
      expect(imported.data?.preview).toEqual([["person", "12"]]);
      const summary = await db
        .from("outcome_runs")
        .select("input_summary")
        .eq("id", run)
        .single();
      expect(summary.data?.input_summary).toEqual({ frozen: true });
    });
    it("blocks direct authenticated mutations, including publication", async () => {
      const updated = await actor.client
        .from("outcome_studies")
        .update({ title: "Bypassed DAL" })
        .eq("id", study);
      expect(updated.error?.code).toBe("42501");
      const published = await clientA.client.from("outcome_reports").insert({
        study_id: study,
        client_id: a,
        run_id: run,
        title: "Forgery",
        payload: {},
        published_by: clientA.userId,
      });
      expect(published.error?.code).toBe("42501");
    });
    it("rejects cross-client source references at the database boundary", async () => {
      const invalid = await db.from("outcome_imports").insert({
        study_id: study,
        client_id: b,
        filename: "bad.csv",
        checksum: "bad",
        storage_path: "bad",
        headers: [],
        rows: [],
        row_count: 1,
        created_by: actor.userId,
      });
      expect(invalid.error?.code).toBe("23503");
    });
    it("keeps original imports, finished analyses, report text and study ownership immutable", async () => {
      const attempts = [
        await db.from("outcome_imports").update({ rows: [] }).eq("id", source),
        await db
          .from("outcome_runs")
          .update({ input: { changed: true } })
          .eq("id", run),
        await db
          .from("outcome_runs")
          .update({ result: { changed: true } })
          .eq("id", run),
        await db
          .from("outcome_reports")
          .update({ title: "Changed" })
          .eq("id", report),
        await db
          .from("outcome_studies")
          .update({ client_id: b })
          .eq("id", study),
      ];
      for (const result of attempts) expect(result.error?.code).toBe("23514");
    });
    it("reserves at most two workers under simultaneous claims", async () => {
      const runs: string[] = [];
      for (let i = 0; i < 3; i++) {
        const id = randomUUID(),
          importId = randomUUID(),
          runId = randomUUID();
        extraStudies.push(id);
        runs.push(runId);
        await insert("outcome_studies", {
          id,
          client_id: a,
          title: `Concurrency ${i}`,
          created_by: actor.userId,
        });
        await insert("outcome_imports", {
          id: importId,
          study_id: id,
          client_id: a,
          filename: "local.csv",
          checksum: importId,
          storage_path: importId,
          headers: [],
          rows: [],
          row_count: 1,
          created_by: actor.userId,
        });
        await insert("outcome_runs", {
          id: runId,
          study_id: id,
          client_id: a,
          import_id: importId,
          input: {},
          input_hash: runId,
          created_by: actor.userId,
        });
      }
      const first = await Promise.all(
        runs.map((id) => db.rpc("claim_outcome_run", { p_run_id: id })),
      );
      for (const claim of first) expect(claim.error).toBeNull();
      // A nonblocking global lock may defer contenders. Retry once sequentially.
      for (const id of runs)
        expect(
          (await db.rpc("claim_outcome_run", { p_run_id: id })).error,
        ).toBeNull();
      const active = await db
        .from("outcome_runs")
        .select("id")
        .in("id", runs)
        .eq("status", "running");
      expect(active.data).toHaveLength(2);
      const clientClaim = await clientA.client.rpc("claim_outcome_run", {
        p_run_id: runs[0],
      });
      expect(clientClaim.error?.code).toBe("42501");
      const leasedId = active.data![0].id;
      const original = await db
        .from("outcome_runs")
        .select("lease_id")
        .eq("id", leasedId)
        .single();
      for (const attempt of [2, 3]) {
        expect(
          (
            await db
              .from("outcome_runs")
              .update({
                claimed_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
              })
              .eq("id", leasedId)
          ).error,
        ).toBeNull();
        const recovered = await db.rpc("claim_outcome_run", {
          p_run_id: leasedId,
        });
        expect(recovered.error).toBeNull();
        expect(recovered.data[0].attempts).toBe(attempt);
        expect(recovered.data[0].lease_id).not.toBe(original.data?.lease_id);
      }
      const stale = await db
        .from("outcome_runs")
        .update({ status: "completed", result: { stale: true } })
        .eq("id", leasedId)
        .eq("lease_id", original.data!.lease_id)
        .select("id");
      expect(stale.data).toEqual([]);
      await db
        .from("outcome_runs")
        .update({
          claimed_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
        })
        .eq("id", leasedId);
      expect(
        (await db.rpc("claim_outcome_run", { p_run_id: leasedId })).data,
      ).toEqual([]);
      expect(
        (
          await db
            .from("outcome_runs")
            .select("status")
            .eq("id", leasedId)
            .single()
        ).data?.status,
      ).toBe("failed");
    });
    it("revokes future report access without permitting edits to the published evidence", async () => {
      expect(
        (
          await db
            .from("outcome_reports")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", report)
        ).error,
      ).toBeNull();
      expect(
        (
          await clientA.client
            .from("outcome_reports")
            .select("id")
            .eq("id", report)
        ).data,
      ).toEqual([]);
      expect(
        (
          await db
            .from("outcome_reports")
            .update({ revoked_at: null })
            .eq("id", report)
        ).error?.code,
      ).toBe("23514");
    });
  },
);
