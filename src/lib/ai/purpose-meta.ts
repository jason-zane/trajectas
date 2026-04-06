import {
  Cpu,
  Layers,
  Sparkles,
  MessageSquare,
  BarChart3,
  ScanSearch,
  FileText,
  FileCog,
} from "lucide-react"
import type { AIPromptPurpose } from "@/types/database"

// ---------------------------------------------------------------------------
// Purpose metadata — shared across the merged AI Configuration page
// ---------------------------------------------------------------------------

export interface PurposeMeta {
  label: string
  description: string
  icon: React.ElementType
  glowColor: string
}

export const PURPOSE_META: Record<AIPromptPurpose, PurposeMeta> = {
  item_generation: {
    label: "Item Generation",
    description:
      "Writes psychometric items for each construct in the AI-GENIE pipeline.",
    icon: Cpu,
    glowColor: "var(--primary)",
  },
  factor_item_generation: {
    label: "Factor Item Generation",
    description:
      "Writes psychometric items using factor-based prompts for structured constructs.",
    icon: Cpu,
    glowColor: "var(--primary)",
  },
  embedding: {
    label: "Embeddings",
    description:
      "Computes vector embeddings for network analysis and redundancy detection.",
    icon: Layers,
    glowColor: "var(--primary)",
  },
  competency_matching: {
    label: "Competency Matching",
    description:
      "Ranks competencies based on diagnostic evidence from the client.",
    icon: Sparkles,
    glowColor: "var(--primary)",
  },
  ranking_explanation: {
    label: "Ranking Explanation",
    description:
      "Generates plain-language explanations for competency rankings.",
    icon: MessageSquare,
    glowColor: "var(--primary)",
  },
  diagnostic_analysis: {
    label: "Diagnostic Analysis",
    description:
      "Analyses assessment results and surfaces key insights for the client.",
    icon: BarChart3,
    glowColor: "var(--primary)",
  },
  library_import_structuring: {
    label: "Library Import Structuring",
    description:
      "Converts messy source text into review-ready CSV for dimensions, factors, constructs, and items.",
    icon: FileCog,
    glowColor: "var(--primary)",
  },
  preflight_analysis: {
    label: "Preflight Analysis",
    description:
      "Checks construct similarity before item generation to detect overlap.",
    icon: ScanSearch,
    glowColor: "var(--primary)",
  },
  chat: {
    label: "Chat",
    description: "General-purpose AI chat for testing and exploration.",
    icon: MessageSquare,
    glowColor: "var(--primary)",
  },
  report_narrative: {
    label: "Report Narrative",
    description:
      "Generates AI-enhanced narrative text for participant and manager reports.",
    icon: FileText,
    glowColor: "var(--primary)",
  },
  report_strengths_analysis: {
    label: "Report Strengths Analysis",
    description:
      "Synthesises a cohesive narrative about the participant's top strengths.",
    icon: FileText,
    glowColor: "var(--primary)",
  },
  report_development_advice: {
    label: "Report Development Advice",
    description:
      "Generates contextual development recommendations based on score profiles.",
    icon: FileText,
    glowColor: "var(--primary)",
  },
  item_critique: {
    label: "Item Critique",
    description:
      "Reviews generated items for construct purity, discriminant validity, and readability.",
    icon: ScanSearch,
    glowColor: "var(--primary)",
  },
  synthetic_respondent: {
    label: "Synthetic Respondent",
    description:
      "Simulates persona-conditioned respondents for in silico scale validation.",
    icon: MessageSquare,
    glowColor: "var(--primary)",
  },
}

export const PURPOSE_ORDER: AIPromptPurpose[] = [
  "chat",
  "item_generation",
  "factor_item_generation",
  "library_import_structuring",
  "preflight_analysis",
  "item_critique",
  "synthetic_respondent",
  "embedding",
  "competency_matching",
  "ranking_explanation",
  "diagnostic_analysis",
  "report_narrative",
  "report_strengths_analysis",
  "report_development_advice",
]
