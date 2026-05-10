import { z, type ZodType } from 'zod'

import { IntegrationApiError } from '@/lib/integrations/errors'
import {
  parseJsonRequestWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const MAX_INTEGRATION_JSON_BODY_BYTES = 64 * 1024

function firstValidationMessage(error: { issues?: Array<{ message?: string }> }) {
  return error.issues?.find((issue) => issue.message)?.message ?? 'The request payload is invalid.'
}

export async function parseIntegrationRequestBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  let body: unknown

  try {
    body = await parseJsonRequestWithLimit(request, MAX_INTEGRATION_JSON_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      throw new IntegrationApiError(
        413,
        'payload_too_large',
        'The request body is too large.'
      )
    }

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
