import { z, type ZodType } from 'zod'

import { IntegrationApiError } from '@/lib/integrations/errors'

function firstValidationMessage(error: { issues?: Array<{ message?: string }> }) {
  return error.issues?.find((issue) => issue.message)?.message ?? 'The request payload is invalid.'
}

export async function parseIntegrationRequestBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new IntegrationApiError(
      400,
      'invalid_json',
      'The request body must be valid JSON.'
    )
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new IntegrationApiError(400, 'invalid_request', firstValidationMessage(parsed.error))
  }

  return parsed.data
}

export function parseUuidParam(value: string, fieldName: string) {
  const parsed = z.string().uuid().safeParse(value)
  if (!parsed.success) {
    throw new IntegrationApiError(400, 'invalid_request', `${fieldName} must be a valid UUID.`)
  }

  return parsed.data
}
