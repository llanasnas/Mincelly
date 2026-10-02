import { NextResponse } from 'next/server'
import { RecipeProcessingError } from './errors'
import { clientKey, rateLimit, type RateLimitOptions } from './rate-limit'

/** Shape of every error body returned by the API. */
export interface ApiError {
  errorCode: string
  error: string
  /** Technical cause. Only sent outside production. */
  detail?: string
}

const isProduction = () => process.env.NODE_ENV === 'production'

export function errorResponse(errorCode: string, error: string, status: number, detail?: string) {
  const body: ApiError = { errorCode, error }
  if (detail && !isProduction()) body.detail = detail
  return NextResponse.json(body, { status })
}

/** Maps an expected processing failure to a 422, logging its technical detail. */
export function processingErrorResponse(err: RecipeProcessingError) {
  if (err.detail) console.error(`[${err.code}] ${err.message} — ${err.detail}`)
  return errorResponse(err.code, err.message, 422, err.detail)
}

/**
 * Applies a per-client rate limit. Returns a 429 response to send back, or null
 * when the request may proceed.
 */
export function rateLimited(req: Request, bucket: string, options: RateLimitOptions) {
  const { allowed, retryAfter } = rateLimit(`${bucket}:${clientKey(req)}`, options)
  if (allowed) return null

  const response = errorResponse(
    'RATE_LIMITED',
    'Demasiadas peticiones seguidas. Espera un momento antes de volver a intentarlo.',
    429,
  )
  response.headers.set('Retry-After', String(retryAfter))
  return response
}
