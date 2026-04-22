import { sanitizeReportHtml } from "@/lib/security/sanitize-html";
import type { BlockType } from "./types";

/**
 * Strips unsafe HTML from fields inside block data that are subsequently
 * rendered as inline HTML by block components. Called in ReportRenderer
 * before data is handed to each component, so the block components themselves
 * always receive already-safe strings.
 *
 * Only score_detail entities and custom_text content currently flow raw HTML
 * to the DOM. Other block types render structured content through React and
 * don't need sanitisation here.
 */
export function sanitizeBlockData(
  type: BlockType,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "custom_text") {
    const content = data.content;
    if (typeof content === "string") {
      return { ...data, content: sanitizeReportHtml(content) };
    }
    return data;
  }

  if (type === "score_detail") {
    const entity = data.entity as Record<string, unknown> | undefined;
    if (!entity) return data;
    return {
      ...data,
      entity: sanitizeEntity(entity),
    };
  }

  return data;
}

function sanitizeEntity(
  entity: Record<string, unknown>,
): Record<string, unknown> {
  const nested = entity.nestedScores;
  return {
    ...entity,
    definition:
      typeof entity.definition === "string"
        ? sanitizeReportHtml(entity.definition)
        : entity.definition,
    description:
      typeof entity.description === "string"
        ? sanitizeReportHtml(entity.description)
        : entity.description,
    narrative:
      typeof entity.narrative === "string"
        ? sanitizeReportHtml(entity.narrative)
        : entity.narrative,
    developmentSuggestion:
      typeof entity.developmentSuggestion === "string"
        ? sanitizeReportHtml(entity.developmentSuggestion)
        : entity.developmentSuggestion,
    nestedScores: Array.isArray(nested)
      ? nested.map((child) =>
          child && typeof child === "object"
            ? sanitizeEntity(child as Record<string, unknown>)
            : child,
        )
      : nested,
  };
}
