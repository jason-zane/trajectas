/**
 * Unit tests for the chat entity-search mappers.
 *
 * The escaping helpers matter more than they look: a search term is
 * model-supplied text that lands in a PostgREST `or=` filter and then in an
 * ILIKE pattern. Two independent layers can be steered by it, and the order
 * they are applied in is load-bearing.
 */

import { describe, expect, it } from "vitest";
import {
  buildSearchPattern,
  searchTokens,
  groupParticipantsByPerson,
  escapeLikePattern,
  sanitiseOrTerm,
  participantDisplayName,
  toParticipantSearchResult,
  toCampaignSearchResult,
  toAssessmentSearchResult,
  type ParticipantSearchRow,
} from "@/lib/dal/chat-search-mappers";

describe("search-term escaping", () => {
  it("treats LIKE wildcards as literal characters", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("back\\slash")).toBe("back\\\\slash");
  });

  it("strips PostgREST or= delimiters that would be read as filter syntax", () => {
    expect(sanitiseOrTerm("a,b")).toBe("a b");
    expect(sanitiseOrTerm("x(y)z")).toBe("x y z");
  });

  it("applies delimiter stripping before wildcard escaping", () => {
    // If the order were reversed, the backslash introduced by escaping could
    // itself be mangled, and a comma would still reach the filter parser.
    const pattern = buildSearchPattern("50%,drop");
    expect(pattern).toBe("%50\\% drop%");
    expect(pattern).not.toContain(",");
  });

  it("wraps the term for a contains-match", () => {
    expect(buildSearchPattern("sarah")).toBe("%sarah%");
  });

  it("a bare wildcard cannot become a match-everything pattern", () => {
    expect(buildSearchPattern("%")).toBe("%\\%%");
  });
});

describe("participantDisplayName", () => {
  const base: ParticipantSearchRow = {
    id: "p1",
    email: "sarah@example.com",
    first_name: "Sarah",
    last_name: "Chen",
    status: "invited",
    campaign_id: "c1",
    person_key: "pk-1",
    campaigns: {
      id: "c1",
      title: "Q1 Leadership",
      client_id: "cl1",
      clients: { id: "cl1", name: "Acme" },
    },
  };

  it("prefers the full name", () => {
    expect(participantDisplayName(base)).toBe("Sarah Chen");
  });

  it("falls back to a partial name", () => {
    expect(participantDisplayName({ ...base, last_name: null })).toBe("Sarah");
  });

  it("falls back to email when no name is stored", () => {
    expect(
      participantDisplayName({ ...base, first_name: null, last_name: null }),
    ).toBe("sarah@example.com");
  });

  it("never returns an empty label", () => {
    expect(
      participantDisplayName({
        ...base,
        first_name: null,
        last_name: null,
        email: null,
      }),
    ).toBe("Unnamed participant");
  });
});

describe("row → DTO mapping", () => {
  it("builds a participant DTO with a working deep link", () => {
    const dto = toParticipantSearchResult({
      id: "p1",
      email: "sarah@example.com",
      first_name: "Sarah",
      last_name: "Chen",
      status: "completed",
      campaign_id: "c1",
      person_key: "pk-1",
      campaigns: {
        id: "c1",
        title: "Q1 Leadership",
        client_id: "cl1",
        clients: { id: "cl1", name: "Acme" },
      },
    });
    expect(dto).toEqual({
      participantId: "p1",
      name: "Sarah Chen",
      email: "sarah@example.com",
      status: "completed",
      campaignId: "c1",
      campaignTitle: "Q1 Leadership",
      personKey: "pk-1",
      clientId: "cl1",
      clientName: "Acme",
      href: "/campaigns/c1/participants/p1",
    });
  });

  it("tolerates a missing joined campaign", () => {
    const dto = toParticipantSearchResult({
      id: "p1",
      email: null,
      first_name: "Solo",
      last_name: null,
      status: null,
      campaign_id: "c9",
      person_key: null,
      campaigns: null,
    });
    expect(dto.campaignTitle).toBeNull();
    expect(dto.href).toBe("/campaigns/c9/participants/p1");
  });

  it("builds campaign and assessment DTOs", () => {
    expect(
      toCampaignSearchResult({
        id: "c1",
        title: "Q1 Leadership",
        status: "active",
        kind: "baseline",
        opens_at: null,
        closes_at: null,
        clients: { id: "cl1", name: "Acme" },
      }).href,
    ).toBe("/campaigns/c1");

    expect(
      toAssessmentSearchResult({
        id: "a1",
        title: "Leadership Inventory",
        slug: "leadership-inventory",
        status: "active",
        scoring_method: "pomp_factor",
        clients: null,
      }),
    ).toMatchObject({
      assessmentId: "a1",
      clientName: null,
      href: "/assessments/a1/edit/overview",
    });
  });
});

describe("searchTokens", () => {
  it("splits a full name into tokens that must each match", () => {
    // "Jason Hunt" against first_name/last_name separately matches nothing —
    // the reason a plain full-name search silently failed.
    expect(searchTokens("Jason Hunt")).toEqual(["Jason", "Hunt"]);
  });

  it("collapses arbitrary whitespace", () => {
    expect(searchTokens("  Jason   Zane  Hunt ")).toEqual([
      "Jason",
      "Zane",
      "Hunt",
    ]);
  });

  it("returns nothing for an empty phrase", () => {
    expect(searchTokens("   ")).toEqual([]);
  });

  it("caps the token count so a pasted paragraph cannot fan out", () => {
    expect(searchTokens("a b c d e f g h").length).toBe(4);
  });
});

describe("groupParticipantsByPerson", () => {
  const row = (
    over: Partial<ReturnType<typeof toParticipantSearchResult>> = {},
  ): ReturnType<typeof toParticipantSearchResult> => ({
    participantId: "p1",
    name: "Jason Hunt",
    email: "jason@example.com",
    status: "completed",
    campaignId: "c1",
    campaignTitle: "Campaign One",
    personKey: "pk-1",
    clientId: "cl1",
    clientName: "Acme",
    href: "/campaigns/c1/participants/p1",
    ...over,
  });

  it("collapses one person's many participations into a single entry", () => {
    const people = groupParticipantsByPerson([
      row({}),
      row({ participantId: "p2", campaignId: "c2", campaignTitle: "Two" }),
      row({ participantId: "p3", campaignId: "c3", campaignTitle: "Three" }),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].participationCount).toBe(3);
    expect(people[0].participantIds).toEqual(["p1", "p2", "p3"]);
    expect(people[0].campaigns).toHaveLength(3);
  });

  it("groups case-insensitively on email when there is no person_key", () => {
    const people = groupParticipantsByPerson([
      row({ personKey: null }),
      row({ participantId: "p2", personKey: null, email: "JASON@EXAMPLE.COM" }),
    ]);
    expect(people).toHaveLength(1);
  });

  it("does not merge distinct people", () => {
    const people = groupParticipantsByPerson([
      row(),
      row({ participantId: "p9", personKey: "pk-9", email: "someone@else.com" }),
    ]);
    expect(people).toHaveLength(2);
  });

  it("keeps the same email under two clients as two people", () => {
    // person_key is client-scoped by design (trajectory person_key): the same
    // human at two clients is deliberately two person records, and merging them
    // would hand one person's participant ids to the other's score lookup.
    const people = groupParticipantsByPerson([
      row({ personKey: "pk-a", clientId: "cl1" }),
      row({ participantId: "p2", personKey: "pk-b", clientId: "cl2" }),
    ]);
    expect(people).toHaveLength(2);
  });

  it("respects an admin merge: one person_key, two emails, one person", () => {
    const people = groupParticipantsByPerson([
      row({ personKey: "pk-merged", email: "old@example.com" }),
      row({ participantId: "p2", personKey: "pk-merged", email: "new@example.com" }),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].participantIds).toEqual(["p1", "p2"]);
  });

  it("keeps rows with neither key nor email separate", () => {
    const people = groupParticipantsByPerson([
      row({ participantId: "p1", personKey: null, email: null }),
      row({ participantId: "p2", personKey: null, email: null }),
    ]);
    expect(people).toHaveLength(2);
  });

  it("dedupes repeat participations within one campaign", () => {
    const people = groupParticipantsByPerson([
      row({ participantId: "p1" }),
      row({ participantId: "p2" }),
    ]);
    expect(people[0].participationCount).toBe(2);
    expect(people[0].campaigns).toHaveLength(1);
  });
});
