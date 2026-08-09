export type {
  BrandConfig,
  BrandOverrides,
  BrandConfigRow,
  BrandConfigRecord,
  BrandOwnerType,
  NeutralTemperature,
  BorderRadiusPreset,
  SpacingDensity,
  TypeScalePreset,
  TypeLevelName,
  TypeLevelStyle,
  TypographySettings,
  ButtonStyle,
  GradientAccent,
  RunnerTheme,
  SurfaceRoleColors,
  RunnerAnchorOverrides,
} from './types'

export {
  TRAJECTAS_DEFAULTS,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_BUTTON_STYLE,
  DEFAULT_SPACING_DENSITY,
} from './defaults'

export { mergeBrandLayers, diffBrandOverrides, isEmptyOverrides } from './merge'

export {
  relativeLuminance,
  contrastRatio,
  auditBrandContrast,
  contrastFailures,
  auditRunnerContrast,
} from './contrast'
export type { ContrastCheck } from './contrast'

export { deriveRunnerAnchors, generateRunnerTokens } from './runner-tokens'
export type { RunnerAnchors, RunnerTokens } from './runner-tokens'

export {
  hexToOklch,
  oklchToHex,
  generateCSSTokens,
  generatePDFStyles,
  generateEmailStyles,
  generateScaleHex,
  resolveTypeLevels,
  resolveSurfaceRoles,
} from './tokens'
export type { CSSTokens, PDFStyles, EmailStyles, SurfaceRole } from './tokens'

export {
  HEADING_BODY_FONTS,
  MONO_FONTS,
  ALL_FONTS,
  getFontByName,
  buildGoogleFontsUrl,
} from './fonts'
export type { FontOption } from './fonts'
