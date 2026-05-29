// =============================================================================
// ai.ts — Types for the AI / LLM integration layer
// =============================================================================

// ---------------------------------------------------------------------------
// Provider types
// ---------------------------------------------------------------------------

/**
 * Supported AI provider vendors.
 * - `anthropic` — Anthropic (Claude family)
 * - `openai`    — OpenAI (GPT family)
 * - `custom`    — Self-hosted or third-party provider behind a compatible API
 */
export type AIProviderType = 'anthropic' | 'openai' | 'custom'

// ---------------------------------------------------------------------------
// Model request / response
// ---------------------------------------------------------------------------

/**
 * A normalised request sent to any AI provider through the abstraction layer.
 * Provider-specific adapters translate this into vendor-native payloads.
 */
export interface AIModelRequest {
  /** The user/human prompt to send to the model. */
  prompt: string
  /** Optional system prompt that sets context and instructions. */
  systemPrompt?: string
  /**
   * Sampling temperature (0–2). Lower values produce more deterministic output.
   * Defaults to the value configured on the `AIModelConfig` row.
   */
  temperature?: number
  /**
   * Maximum number of tokens the model may generate in its response.
   * Defaults to the value configured on the `AIModelConfig` row.
   */
  maxTokens?: number
  /**
   * Desired response format.
   * - `text` — free-form text (default)
   * - `json` — the model is instructed to return valid JSON
   */
  responseFormat?: 'text' | 'json'
  /**
   * Optional model override. When provided, the provider uses this model
   * instead of its configured default. Use OpenRouter model IDs e.g. "anthropic/claude-sonnet-4-5".
   */
  model?: string
}

/**
 * A normalised response returned from any AI provider through the abstraction layer.
 */
export interface AIModelResponse {
  /** The generated text content. */
  content: string
  /** Token usage statistics for billing and monitoring. */
  usage: {
    /** Number of tokens consumed by the input (prompt + system). */
    inputTokens: number
    /** Number of tokens generated in the output. */
    outputTokens: number
  }
  /** The specific model identifier that produced this response (e.g. "claude-opus-4-20250514"). */
  model: string
  /** The vendor that served the request. */
  provider: AIProviderType
}

// ---------------------------------------------------------------------------
// Competency matching types
// ---------------------------------------------------------------------------

/**
 * A single competency in the ranked output of the matching engine.
 * Includes the AI's reasoning and value-add metrics.
 */
export interface FactorRanking {
  /** UUID of the competency. */
  factorId: string
  /** Human-readable competency name. */
  factorName: string
  /** Ordinal rank (1 = most relevant to the client's diagnostic profile). */
  rank: number
  /**
   * Normalised relevance score (0–1) representing how strongly the
   * competency aligns with the client's diagnostic data.
   */
  relevanceScore: number
  /** AI-generated natural-language explanation for why this competency was ranked here. */
  reasoning: string
  /**
   * The additional assessment value this competency provides beyond those
   * ranked above it. Measured on a 0–1 scale; high values indicate low
   * redundancy with higher-ranked competencies.
   */
  incrementalValue: number
  /**
   * The cumulative assessment coverage achieved by including this competency
   * and all those ranked above it. Measured on a 0–1 scale.
   */
  cumulativeValue: number
}

/** Seniority level a brief / factor applies to. */
export type AssessmentLevel =
  | 'ic'
  | 'first_line_manager'
  | 'mid_manager'
  | 'senior_leader'
  | 'executive'

/** The decision being made — the coarse stored outcome category. */
export type AssessmentOutcome = 'selection' | 'development' | 'team_composition'

/**
 * Structured brief extracted from a role description by the Architect.
 * Produced by the `brief_extraction` AI task; consumed by the matcher.
 */
export interface Brief {
  /** Best inference of the role title; may be empty if genuinely unclear. */
  roleTitle: string
  /** Inferred seniority level. */
  level: AssessmentLevel
  /** Job family (e.g. "sales", "engineering"); may be empty. */
  function: string
  /** Coarse stored outcome category used for factor eligibility filtering. */
  outcome: AssessmentOutcome
  /** The user's stated decision verbatim (e.g. "succession planning") — feeds matcher reasoning. */
  outcomeIntent: string
  /** 3–7 concise responsibility bullets drawn from the source. */
  responsibilities: string[]
  /** Contextual signals (e.g. "fast-growth startup", "regulated industry"). */
  contextSignals: string[]
  /** Domain/technical skills explicitly mentioned. */
  technicalRequirements: string[]
  /** How well the input supported a useful brief. */
  confidence: 'high' | 'medium' | 'low'
}

/** A single factor in the pool the matcher evaluates and ranks. */
export interface MatchingFactor {
  /** UUID of the factor. */
  id: string
  /** Factor display name. */
  name: string
  /** Prose describing what the factor measures (definition, falling back to description). */
  definition: string
  /** Eligibility: outcomes this factor suits. Empty = applies to all. */
  applicableOutcomes?: string[]
  /** Eligibility: levels this factor suits. Empty = applies to all. */
  applicableLevels?: string[]
  /** Soft signal: job functions this factor suits. Informs ranking, not eligibility. */
  applicableFunctions?: string[]
}

/**
 * Where the matching brief is sourced from. Both paths feed the same ranking
 * stage; they differ only in how the "what matters for this role" signal is
 * derived.
 * - `diagnostic` — measured organisational reality (org-diagnostic flow)
 * - `brief`      — stated intent extracted from a role description (Architect)
 */
export type MatchingSource =
  | {
      kind: 'diagnostic'
      /** UUID of the client being matched. */
      clientId: string
      /** Aggregated diagnostic data keyed by dimension ID (weighted means). */
      diagnosticData: Record<string, number>
    }
  | {
      kind: 'brief'
      /** Structured brief extracted from a role description. */
      brief: Brief
    }

/**
 * Input data assembled for a matching run and sent to the AI layer.
 */
export interface MatchingInput {
  /** The source of the matching signal (diagnostic scores or a role brief). */
  source: MatchingSource
  /** The pool of factors the AI should evaluate and rank. */
  availableFactors: MatchingFactor[]
}

/**
 * Structured output produced by the AI matching engine.
 * Stored in the database and surfaced through the API.
 */
export interface MatchingOutput {
  /** Ordered list of competency rankings (index 0 = rank 1). */
  rankings: FactorRanking[]
  /**
   * AI-generated executive summary explaining the overall matching
   * rationale and key themes from the diagnostic data.
   */
  summary: string
  /**
   * Guidance on how many competencies to include in the final assessment.
   * Based on the diminishing-returns curve of `cumulativeValue`.
   */
  recommendedCount: {
    /** Absolute minimum for meaningful assessment coverage. */
    minimum: number
    /** Sweet spot balancing coverage and assessment length. */
    optimal: number
    /** Upper limit before incremental value becomes negligible. */
    maximum: number
  }
  /** The model identifier that produced this output (e.g. "claude-opus-4-20250514"). */
  modelUsed: string
  /** Version number of the system prompt used for this run. */
  promptVersion: number
}

// ---------------------------------------------------------------------------
// Prompt construction helpers
// ---------------------------------------------------------------------------

/**
 * Variables injected into a system prompt template before it is sent to the model.
 * Templates use `{{variableName}}` placeholders.
 */
export interface PromptTemplateVariables {
  /** Name of the client. */
  clientName?: string
  /** Industry of the client. */
  industry?: string
  /** JSON-serialised diagnostic data summary. */
  diagnosticSummary?: string
  /** JSON-serialised list of available competencies. */
  factorList?: string
  /** Any additional context the prompt template requires. */
  [key: string]: string | undefined
}

/**
 * A fully resolved prompt ready to be sent to the AI layer,
 * after template variables have been substituted.
 */
export interface ResolvedPrompt {
  /** The final system prompt text. */
  systemPrompt: string
  /** The final user prompt text. */
  userPrompt: string
  /** Version of the system prompt template that was used. */
  promptVersion: number
  /** Purpose category for audit logging. */
  purpose: 'competency_matching' | 'ranking_explanation' | 'diagnostic_analysis'
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/** Base error class for all AI-layer errors. */
export class AIError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AIError'
  }
}

/** Thrown when a requested provider is not registered or unavailable. */
export class ProviderNotFoundError extends AIError {
  constructor(providerType: string) {
    super(`AI provider not found or unavailable: ${providerType}`)
    this.name = 'ProviderNotFoundError'
  }
}

/** Thrown when an AI provider API call fails. */
export class ProviderRequestError extends AIError {
  constructor(public readonly provider: string, cause?: unknown) {
    super(
      `AI provider "${provider}" request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    )
    this.name = 'ProviderRequestError'
  }
}

/** Thrown when the AI response cannot be parsed into the expected format. */
export class ResponseParseError extends AIError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'ResponseParseError'
  }
}
