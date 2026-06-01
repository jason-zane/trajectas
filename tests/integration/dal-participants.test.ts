import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getParticipantById } from "@/lib/dal/participants";

const ts = Date.now();
// campaigns_slug_format requires lowercase [a-z0-9-].
const slug = (s: string) => `dalp-${s}-${ts}`.toLowerCase();

describe.skipIf(!canRun)("dal/participants: getParticipantById", () => {
  const admin = createAdminClient();
  const ids = { client: "", campaign: "", participant: "", deletedParticipant: "" };

  beforeAll(async () => {
    const { data: c, error: cErr } = await admin
      .from("clients")
      .insert({ name: `DAL Client ${ts}`, slug: slug("client") })
      .select("id")
      .single();
    if (cErr) throw new Error(`client insert: ${cErr.message}`);
    ids.client = c!.id;

    const { data: cam, error: camErr } = await admin
      .from("campaigns")
      .insert({ title: `DAL Campaign ${ts}`, slug: slug("campaign"), client_id: ids.client })
      .select("id")
      .single();
    if (camErr) throw new Error(`campaign insert: ${camErr.message}`);
    ids.campaign = cam!.id;

    const { data: p, error: pErr } = await admin
      .from("campaign_participants")
      .insert({ campaign_id: ids.campaign, email: `dalp-${ts}@test.local`, first_name: "Dal", last_name: "Tester" })
      .select("id")
      .single();
    if (pErr) throw new Error(`participant insert: ${pErr.message}`);
    ids.participant = p!.id;

    const { data: dp, error: dpErr } = await admin
      .from("campaign_participants")
      .insert({
        campaign_id: ids.campaign,
        email: `dalp-del-${ts}@test.local`,
        first_name: "Del",
        last_name: "Eted",
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (dpErr) throw new Error(`deleted participant insert: ${dpErr.message}`);
    ids.deletedParticipant = dp!.id;
  });

  afterAll(async () => {
    await admin
      .from("campaign_participants")
      .delete()
      .in("id", [ids.participant, ids.deletedParticipant].filter(Boolean));
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("returns the participant mapped with campaign + client context", async () => {
    const p = await getParticipantById(ids.participant);
    expect(p).not.toBeNull();
    expect(p!.id).toBe(ids.participant);
    expect(p!.campaignTitle).toBe(`DAL Campaign ${ts}`);
    expect(p!.campaignSlug).toBe(slug("campaign"));
    expect(p!.clientName).toBe(`DAL Client ${ts}`);
  });

  it("returns null for a non-existent id", async () => {
    expect(await getParticipantById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns null for a soft-deleted participant", async () => {
    expect(await getParticipantById(ids.deletedParticipant)).toBeNull();
  });
});
