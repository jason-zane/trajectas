export type AssessRuntimeErrorKind = "not-ready" | "unavailable" | "temporary";

export interface ClassifiedAssessError {
  kind: AssessRuntimeErrorKind;
  eyebrow: string;
  title: string;
  description: string;
}

/**
 * Maps a participant-runtime error message into branded, actionable copy.
 * Falls back to a generic "temporary" bucket when the message isn't recognised
 * so the participant still sees a branded surface rather than bare red text.
 */
export function classifyAssessRuntimeError(message: string): ClassifiedAssessError {
  const msg = message.toLowerCase();

  if (
    msg.includes("not available in the active campaign") ||
    msg.includes("does not belong to the active campaign") ||
    msg.includes("does not match the active access token")
  ) {
    return {
      kind: "not-ready",
      eyebrow: "This assessment isn't ready",
      title: "The campaign isn't fully set up yet.",
      description:
        "Whoever invited you is still configuring this campaign. Please reach out to them — they can sort it out and send you back in.",
    };
  }

  if (
    msg.includes("session not found") ||
    msg.includes("session does not belong")
  ) {
    return {
      kind: "unavailable",
      eyebrow: "Assessment not found",
      title: "We couldn't pick up where you left off.",
      description:
        "Your session may have been reset, or this link belongs to a different participant. Try starting again from the welcome page, or reach out to whoever sent you the invite.",
    };
  }

  return {
    kind: "temporary",
    eyebrow: "Something went wrong",
    title: "We couldn't load your assessment right now.",
    description:
      "This looks like a short-term issue on our end. Give it a moment and try again — if it keeps happening, contact whoever sent you the invite.",
  };
}
