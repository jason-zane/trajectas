/**
 * The AI settings page renders PURPOSE_ORDER, not the canonical purpose list.
 *
 * That is a hand-maintained array typed `AIPromptPurpose[]`, which accepts a
 * SUBSET without complaint — so a new purpose gets its prompt row, its model
 * row and its metadata, and still never appears in Settings → AI. It is
 * configurable in the database and invisible in the UI, which reads as
 * "hard-coded" to anyone trying to change it.
 *
 * That is exactly what happened to chat_data. purposes.ts already documents
 * this class of drift for the validation enums; this closes the same gap for
 * the settings page.
 */

import { describe, expect, it } from "vitest";
import { AI_PROMPT_PURPOSES } from "@/lib/ai/purposes";
import { PURPOSE_ORDER, PURPOSE_META } from "@/lib/ai/purpose-meta";

describe("AI settings page covers every purpose", () => {
  it("PURPOSE_ORDER lists every purpose in AI_PROMPT_PURPOSES", () => {
    const ordered = new Set(PURPOSE_ORDER);
    const missing = AI_PROMPT_PURPOSES.filter((p) => !ordered.has(p));
    expect(
      missing,
      `These purposes exist but would not render in Settings → AI: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("PURPOSE_ORDER contains nothing that is not a real purpose", () => {
    const known = new Set<string>(AI_PROMPT_PURPOSES);
    expect(PURPOSE_ORDER.filter((p) => !known.has(p))).toEqual([]);
  });

  it("lists each purpose exactly once", () => {
    expect(new Set(PURPOSE_ORDER).size).toBe(PURPOSE_ORDER.length);
  });

  it("every ordered purpose has metadata to render", () => {
    for (const purpose of PURPOSE_ORDER) {
      expect(PURPOSE_META[purpose], `${purpose} has no metadata`).toBeDefined();
    }
  });
});
