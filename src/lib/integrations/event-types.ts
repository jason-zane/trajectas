export const INTEGRATION_EVENT_TYPES = [
  'integration.launch.created',
  'integration.assessment.completed',
  'integration.report.ready',
  'integration.report.released',
] as const

export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number]
