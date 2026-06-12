import { sanitizeReportHtml } from "@/lib/security/sanitize-html";
import type { BlockType } from "./types";

/**
 * Strips unsafe HTML from fields inside block data that are subsequently
 * rendered as inline HTML by block components. Called in ReportRenderer
 * before data is handed to each component, so the block components themselves
 * always receive already-safe strings.
 *
 * Block types that flow library/admin HTML to the DOM: custom_text content,
 * score_detail entities, score_overview descriptions, dimension_chapter
 * summaries/factor layers, and closing_page copy. Other block types render
 * structured content through React and don't need sanitisation here.
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
    // Legacy snapshots carry entity fields flat on data; sanitizeEntity also
    // walks nestedScores. Harmless no-op for the multi-entity shape.
    const out = sanitizeEntity({ ...data });
    // Multi-entity shape (current runner output)
    if (Array.isArray(out.entities)) {
      out.entities = out.entities.map((entity) =>
        entity && typeof entity === "object"
          ? sanitizeEntity(entity as Record<string, unknown>)
          : entity,
      );
    }
    // Legacy nested single-entity shape
    const entity = out.entity as Record<string, unknown> | undefined;
    if (entity) {
      out.entity = sanitizeEntity(entity);
    }
    return out;
  }

  if (type === "closing_page") {
    return sanitizeHtmlFields(data, ["methodologyText", "confidentialityText"]);
  }

  if (type === "score_overview") {
    const scores = data.scores;
    if (!Array.isArray(scores)) return data;
    return {
      ...data,
      scores: scores.map((score) =>
        score && typeof score === "object"
          ? sanitizeHtmlFields(score as Record<string, unknown>, ["description"])
          : score,
      ),
    };
  }

  if (type === "dimension_chapter") {
    const chapters = data.chapters;
    if (!Array.isArray(chapters)) return data;
    return {
      ...data,
      chapters: chapters.map((chapter) => {
        if (!chapter || typeof chapter !== "object") return chapter;
        const c = sanitizeHtmlFields(chapter as Record<string, unknown>, ["summary"]);
        const factors = c.factors;
        return {
          ...c,
          factors: Array.isArray(factors)
            ? factors.map((factor) =>
                factor && typeof factor === "object"
                  ? sanitizeHtmlFields(factor as Record<string, unknown>, [
                      "description",
                      "indicators",
                      "development",
                    ])
                  : factor,
              )
            : factors,
        };
      }),
    };
  }

  return data;
}

/** Sanitize the named string fields on an object, leaving everything else untouched. */
function sanitizeHtmlFields(
  obj: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const out = { ...obj };
  for (const field of fields) {
    if (typeof out[field] === "string") {
      out[field] = sanitizeReportHtml(out[field] as string);
    }
  }
  return out;
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
