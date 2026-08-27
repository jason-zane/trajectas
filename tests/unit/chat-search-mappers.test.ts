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
    campaigns: { id: "c1", title: "Q1 Leadership" },
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
      campaigns: { id: "c1", title: "Q1 Leadership" },
    });
    expect(dto).toEqual({
      participantId: "p1",
      name: "Sarah Chen",
      email: "sarah@example.com",
      status: "completed",
      campaignId: "c1",
      campaignTitle: "Q1 Leadership",
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
