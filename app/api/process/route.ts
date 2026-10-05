// Mammoth (via docx extractor) only runs in Node.js runtime.
export const runtime = 'nodejs'
// Vision OCR + parsing + nutrition lookups can take well over the 10s default.
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { detectFileKind, extractFile } from '@/lib/extractors'
import { extract as extractYoutube } from '@/lib/extractors/youtube'
import { processRecipe } from '@/lib/process-recipe'
import { RecipeProcessingError, publicMessage } from '@/lib/errors'
import { errorResponse, processingErrorResponse, rateLimited } from '@/lib/api'
import { getAvailableProviders } from '@/lib/llm/provider'
import type { LLMProvider } from '@/lib/llm/types'

/** Max characters accepted in a text or URL input — prevents cost-amplification attacks */
const MAX_TEXT_CHARS = 50_000
const MAX_URL_LENGTH = 512
/** Max file size for uploads. Note that Vercel itself rejects request bodies over 4.5 MB. */
const MAX_FILE_BYTES = 10 * 1024 * 1024
const RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }

/** The provider picked in the UI, if it is one this deployment actually has configured. */
function requestedProvider(value: FormDataEntryValue | null): LLMProvider | undefined {
  return getAvailableProviders().find((p) => p.id === value)?.id
}

/**
 * POST /api/process
 *
 * Accepts multipart/form-data with ONE of:
 *   text  (string) — plain text recipe
 *   url   (string) — YouTube URL
 *   file  (File)   — .docx, .pdf or image
 * and optionally `provider` to pick the LLM.
 *
 * Returns the structured Recipe JSON. Does NOT persist to DB.
 * On failure returns { errorCode, error } with appropriate HTTP status.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimited(req, 'process', RATE_LIMIT)
  if (limited) return limited

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return errorResponse('PARSING_FAILED', 'Los datos del formulario no son válidos.', 400)
  }

  const text = formData.get('text')
  const url = formData.get('url')
  const file = formData.get('file')
  const provider = requestedProvider(formData.get('provider'))

  let rawText: string
  try {
    if (typeof text === 'string' && text.trim()) {
      if (text.length > MAX_TEXT_CHARS) {
        return errorResponse(
          'PARSING_FAILED',
          `El texto es demasiado largo. El máximo son ${MAX_TEXT_CHARS.toLocaleString('es-ES')} caracteres.`,
          413,
        )
      }
      rawText = text.trim()
    } else if (typeof url === 'string' && url.trim()) {
      if (url.length > MAX_URL_LENGTH) {
        return errorResponse('PARSING_FAILED', 'La URL es demasiado larga.', 413)
      }
      rawText = await extractYoutube(url)
    } else if (file instanceof File) {
      if (file.size > MAX_FILE_BYTES) {
        return errorResponse('PARSING_FAILED', 'El archivo es demasiado grande. El máximo son 10 MB.', 413)
      }
      const kind = detectFileKind(file)
      if (!kind) {
        return errorResponse(
          'PARSING_FAILED',
          'Tipo de archivo no compatible. Usa una imagen (JPG, PNG, WebP), un .docx o un .pdf.',
          415,
        )
      }
      rawText = await extractFile(kind, Buffer.from(await file.arrayBuffer()), provider)
    } else {
      return errorResponse('EMPTY_CONTENT', 'Envía un texto, una URL de YouTube o un archivo.', 400)
    }
  } catch (err) {
    // RecipeProcessingError must be checked before the generic fallback.
    if (err instanceof RecipeProcessingError) return processingErrorResponse(err)
    console.error('[process] extraction failed', err)
    return errorResponse('PARSING_FAILED', publicMessage(err, 'No se pudo leer el contenido.'), 500)
  }

  try {
    const recipe = await processRecipe(rawText, provider)
    return NextResponse.json(recipe)
  } catch (err) {
    if (err instanceof RecipeProcessingError) return processingErrorResponse(err)
    console.error('[process] processing failed', err)
    return errorResponse('AI_EXTRACTION_FAILED', publicMessage(err, 'No se pudo procesar la receta.'), 500)
  }
}
