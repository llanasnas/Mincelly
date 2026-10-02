export type RecipeErrorCode =
  | 'EMPTY_CONTENT'
  | 'OCR_FAILED'
  | 'TRANSCRIPT_NOT_AVAILABLE'
  | 'PARSING_FAILED'
  | 'AI_EXTRACTION_FAILED'

/**
 * An expected failure while extracting or parsing a recipe.
 *
 * `message` is written for the person using the app and is always safe to show.
 * `detail` carries the technical cause (provider errors, raw model output) — it
 * is logged server-side and only reaches the client outside production.
 */
export class RecipeProcessingError extends Error {
  constructor(
    public readonly code: RecipeErrorCode,
    message: string,
    public readonly detail?: string,
  ) {
    super(message)
    this.name = 'RecipeProcessingError'
  }
}

/**
 * Returns a safe error message for API responses.
 * In production: returns the fallback to avoid leaking internal details.
 * In development: returns the real message for easier debugging.
 */
export function publicMessage(err: unknown, fallback = 'Internal server error'): string {
  if (process.env.NODE_ENV !== 'production') {
    return err instanceof Error ? err.message : fallback
  }
  return fallback
}
