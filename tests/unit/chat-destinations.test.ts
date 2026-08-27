/**
 * Deep links must carry state.
 *
 * The whole point of handing the user to Trajectory or Compare is that the
 * answer they just asked for is already loaded. A link that drops its ids is
 * worse than no link at all, because it looks like it worked and then asks them
 * to re-enter everything.
 *
 * The param shapes are pinned against the pages that read them:
 *   participants/trajectory/page.tsx — `?ids=` comma list, capped at
 *     CANVAS_MAX_PEOPLE (8)
 *   participants/compare/page.tsx — `?ids=` comma list, `?assessments=`
 */

import { describe, expect, it } from "vitest";
import {
  trajectoryForPerson,
  trajectoryForPeople,
  compareMatrixFor,
  campaignResults,
  campaignParticipants,
  TRAJECTORY_MAX_PEOPLE,
} from "@/lib/chat/destinations";

describe("trajectoryForPerson", () => {
  it("carries every participation so the history is not silently shortened", () => {
    const d = trajectoryForPerson(["cp1", "cp2", "cp3"]);
    expect(d?.href).toBe("/participants/trajectory?ids=cp1,cp2,cp3");
  });

  it("dedupes ids", () => {
    expect(trajectoryForPerson(["cp1", "cp1"])?.href).toBe(
      "/participants/trajectory?ids=cp1",
    );
  });

  it("respects the canvas cap", () => {
    const many = Array.from({ length: 12 }, (_, i) => `cp${i}`);
    const ids = trajectoryForPerson(many)!.href.split("ids=")[1].split(",");
    expect(ids).toHaveLength(TRAJECTORY_MAX_PEOPLE);
  });

  it("returns null rather than a link to nothing", () => {
    expect(trajectoryForPerson([])).toBeNull();
    expect(trajectoryForPerson([""])).toBeNull();
  });
});

describe("trajectoryForPeople", () => {
  it("takes one id per person so eight people fit, not one person's eight sittings", () => {
    const d = trajectoryForPeople(["a1", "b1", "c1"]);
    expect(d?.href).toBe("/participants/trajectory?ids=a1,b1,c1");
  });

  it("skips blanks rather than emitting an empty id", () => {
    const d = trajectoryForPeople(["a1", "", "c1"]);
    expect(d?.href).toBe("/participants/trajectory?ids=a1,c1");
  });
});

describe("compareMatrixFor", () => {
  it("pins the assessment when one was chosen", () => {
    const d = compareMatrixFor(["a1", "b1"], "asmt-1");
    expect(d?.href).toBe("/participants/compare?ids=a1,b1&assessments=asmt-1");
  });

  it("omits the assessment param when none applies", () => {
    expect(compareMatrixFor(["a1", "b1"])?.href).toBe(
      "/participants/compare?ids=a1,b1",
    );
  });
});

describe("campaign destinations", () => {
  it("points at the real campaign surfaces", () => {
    expect(campaignResults("c1").href).toBe("/campaigns/c1/results");
    expect(campaignParticipants("c1").href).toBe("/campaigns/c1/participants");
  });

  it("every destination explains what is there", () => {
    for (const d of [
      trajectoryForPerson(["cp1"])!,
      compareMatrixFor(["a", "b"])!,
      campaignResults("c1"),
    ]) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });
});

describe("comparison links use the sitting's own participation row", () => {
  it("is built from the selected ids, not from whichever row is newest", () => {
    // The compare page loads sessions attached to the exact id it is given, so
    // linking a person's newest participation while the shared assessment was
    // sat under an older one opens a matrix with empty cells.
    const selected = ["cp-old-a", "cp-old-b"];
    expect(compareMatrixFor(selected, "asmt-1")?.href).toBe(
      "/participants/compare?ids=cp-old-a,cp-old-b&assessments=asmt-1",
    );
  });
});
