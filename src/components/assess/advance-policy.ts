/**
 * How the runner moves on from an answered item, per response format.
 *
 * Pure so it can be pinned by tests/unit/assess-advance-policy.test.ts;
 * section-wrapper.tsx is the only consumer.
 *
 * Two families of format:
 *
 *  - AUTO_ADVANCE: single-select — the tap IS the commit, and the runner
 *    moves to the next unanswered item after the crossfade. (forced_choice
 *    and sjt refine this in the wrapper: forced_choice waits for both
 *    most+least; sjt only in single-select mode.)
 *  - CONTINUE: multi-step input the participant composes over several
 *    interactions (free text, ranking), so an explicit Continue commits it.
 *
 * `cognitive` (figural matrices) is single-select and auto-advances like the
 * rest — decision after the Mensa Norway benchmark sitting, see
 * docs/superpowers/specs/2026-08-19-mensa-norway-benchmark.md §5.3 — with one
 * coupling that carries doc 03-logical-reasoning-design.md §7.3's concern:
 * a slipped tap on a dense answer grid is scored as a wrong answer, so it
 * must be recoverable. Where the section allows back-navigation, Back is the
 * undo and the tap advances. Where it does not (`allow_back_nav = false`),
 * there is no undo, so the item keeps the explicit tap + Continue.
 */

/** Formats that auto-advance on selection (single-select). */
export const AUTO_ADVANCE_FORMATS: ReadonlySet<string> = new Set([
  "likert",
  "forced_choice",
  "binary",
  "sjt",
  "cognitive",
]);

/** Formats that need a Continue button (multi-step input). */
export const CONTINUE_FORMATS: ReadonlySet<string> = new Set([
  "free_text",
  "ranking",
]);

/**
 * A cognitive item in a section the participant cannot revisit keeps the
 * explicit Continue — the only way a mis-tap stays undoable without Back.
 * `allowBackNav` is the section's flag; `undefined` means the DB default
 * (true), so only an explicit `false` locks the section.
 */
export function cognitiveNeedsConfirm(
  formatType: string,
  allowBackNav: boolean | undefined,
): boolean {
  return formatType === "cognitive" && allowBackNav === false;
}

/** Whether the item shows a Continue button once answered. */
export function formatNeedsContinue(
  formatType: string,
  allowBackNav: boolean | undefined,
): boolean {
  return (
    CONTINUE_FORMATS.has(formatType) ||
    cognitiveNeedsConfirm(formatType, allowBackNav)
  );
}

/**
 * Whether selecting an option moves the runner on by itself. The wrapper
 * layers forced_choice's both-selected and sjt's single-select conditions on
 * top of this; this is the format-level answer.
 */
export function formatAutoAdvances(
  formatType: string,
  allowBackNav: boolean | undefined,
): boolean {
  if (formatType === "cognitive") {
    return !cognitiveNeedsConfirm(formatType, allowBackNav);
  }
  return AUTO_ADVANCE_FORMATS.has(formatType);
}
