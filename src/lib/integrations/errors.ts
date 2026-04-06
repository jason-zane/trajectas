export class IntegrationApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'IntegrationApiError'
    this.status = status
    this.code = code
  }
}

export function isIntegrationApiError(error: unknown): error is IntegrationApiError {
  return error instanceof IntegrationApiError
}
