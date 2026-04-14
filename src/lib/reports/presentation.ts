// =============================================================================
// src/lib/reports/presentation.ts — Presentation mode, chart type, and theme
// =============================================================================

export const PRESENTATION_MODES = ['featured', 'open', 'carded', 'split', 'inset'] as const
export type PresentationMode = (typeof PRESENTATION_MODES)[number]

export const CHART_TYPES = ['bar', 'radar', 'gauges', 'segment', 'scorecard', 'grouped_bar', 'radar_360', 'gap'] as const
export type ChartType = (typeof CHART_TYPES)[number]

export interface ReportTheme {
  // Score colours
  reportHighBandFill: string
  reportMidBandFill: string
  reportLowBandFill: string
  reportHighBadgeBg: string
  reportHighBadgeText: string
  reportMidBadgeBg: string
  reportMidBadgeText: string
  reportLowBadgeBg: string
  reportLowBadgeText: string

  // Surfaces
  reportFeaturedBg: string
  reportFeaturedText: string
  reportFeaturedAccent: string
  reportInsetBg: string
  reportInsetBorder: string
  reportPageBg: string
  reportCardBg: string
  reportCardBorder: string
  reportDivider: string
  reportCtaBg: string
  reportCtaText: string

  // Typography
  reportHeadingColour: string
  reportBodyColour: string
  reportMutedColour: string
  reportLabelColour: string
  reportCoverAccent: string

  // Charts
  reportRadarFill: string
  reportRadarStroke: string
  reportRadarPoint: string
  reportBarDot: string

  // 360 rater colours
  reportRaterSelf: string
  reportRaterManager: string
  reportRaterPeers: string
  reportRaterDirects: string
  reportRaterOverall: string
}

export const DEFAULT_REPORT_THEME: ReportTheme = {
  reportHighBandFill: '#3d8b72',
  reportMidBandFill: '#d4a843',
  reportLowBandFill: '#c75c5c',
  reportHighBadgeBg: '#e6f2ed',
  reportHighBadgeText: '#2a6b52',
  reportMidBadgeBg: '#faf3e0',
  reportMidBadgeText: '#8a6510',
  reportLowBadgeBg: '#fce8e8',
  reportLowBadgeText: '#a94442',

  reportFeaturedBg: '#1e3a32',
  reportFeaturedText: '#ffffff',
  reportFeaturedAccent: '#c9a962',
  reportInsetBg: '#f3f2ee',
  reportInsetBorder: '#2d6a5a',
  reportPageBg: '#fafaf8',
  reportCardBg: '#ffffff',
  reportCardBorder: '#e8e6e1',
  reportDivider: '#e8e6e1',
  reportCtaBg: '#c9a962',
  reportCtaText: '#1e3a32',

  reportHeadingColour: '#1a1a1a',
  reportBodyColour: '#555555',
  reportMutedColour: '#999999',
  reportLabelColour: '#999999',
  reportCoverAccent: '#2d6a5a',

  reportRadarFill: 'rgba(45,106,90,0.12)',
  reportRadarStroke: '#2d6a5a',
  reportRadarPoint: '#2d6a5a',
  reportBarDot: '#2d6a5a',

  reportRaterSelf: '#2d6a5a',
  reportRaterManager: '#5b3fc5',
  reportRaterPeers: '#c9a962',
  reportRaterDirects: '#b85c6a',
  reportRaterOverall: '#666666',
}
