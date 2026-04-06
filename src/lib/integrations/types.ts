export const INTEGRATION_API_SCOPES = [
  'campaigns:read',
  'campaigns:write',
  'participants:read',
  'participants:write',
  'launches:read',
  'launches:write',
  'results:read',
  'reports:read',
] as const

export type IntegrationApiScope = (typeof INTEGRATION_API_SCOPES)[number]

export type IntegrationAuthContext = {
  requestId: string
  clientId: string
  connectionId: string
  connectionProvider: string
  credentialId: string
  credentialLabel: string
  scopes: IntegrationApiScope[]
}

export type InternalApiContext = {
  requestId: string
}

export type IntegrationExternalRefInput = {
  sourceSystem: string
  remoteObjectType: string
  remoteId: string
  secondaryRemoteId?: string
  metadata?: Record<string, unknown>
}

export type IntegrationLaunchRecord = {
  id: string
  clientId: string
  campaignId: string
  participantId: string
  deliveryMethod: 'link' | 'email'
  status: 'created' | 'delivered' | 'delivery_failed'
  assessmentUrl: string
  launchedAt: string
  deliveredAt?: string
  errorMessage?: string
}
