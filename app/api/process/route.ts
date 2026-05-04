// Mammoth (via docx extractor) only runs in Node.js runtime.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { extract as extractDocx } from '@/lib/extractors/docx'
import { extract as extractImage } from '@/lib/extractors/image'
import { extract as extractYoutube } from '@/lib/extractors/youtube'
import { extract as extractText } from '@/lib/extractors/text'
import { processRecipe } from '@/lib/process-recipe'
import { RecipeProcessingError, publicMessage } from '@/lib/errors'
import type { LLMProvider } from '@/lib/llm/types'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/

/** Max characters accepted in a text or URL input — prevents cost-amplification attacks */
const MAX_TEXT_CHARS = 50_000
const MAX_URL_LENGTH = 512
/** Max file size for docx/image uploads via this endpoint */
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ errorCode: code, error: message }, { status })
}

/**
 * POST /api/process
 *
 * Accepts multipart/form-data with ONE of:
 *   text  (string) — plain text recipe
 *   url   (string) — YouTube URL
 *   file  (File)   — .docx or image
 *
 * Returns the structured Recipe JSON. Does NOT persist to DB.
 * On failure returns { errorCode, error } with appropriate HTTP status.
 */
export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return errorResponse('PARSING_FAILED', 'Invalid form data', 400)
  }

  const text = formData.get('text')
  const url = formData.get('url')
  const file = formData.get('file')

  let rawText: string

  try {
    if (typeof text === 'string' && text.trim()) {
      if (text.length > MAX_TEXT_CHARS) {
        return errorResponse('PARSING_FAILED', `Text too long. Maximum ${MAX_TEXT_CHARS.toLocaleString()} characters allowed.`, 413)
      }
      rawText = await extractText(text.trim())
    } else if (typeof url === 'string' && url.trim()) {
      if (url.length > MAX_URL_LENGTH) {
        return errorResponse('PARSING_FAILED', 'URL too long.', 413)
      }
      if (YOUTUBE_RE.test(url.trim())) {
        rawText = await extractYoutube(url.trim())
      } else {
        rawText = await extractText(url.trim())
      }
    } else if (file instanceof File) {
      if (file.size > MAX_FILE_BYTES) {
        return errorResponse('PARSING_FAILED', 'File too large. Maximum size is 10 MB.', 413)
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const mime = file.type

      if (mime === DOCX_MIME || file.name.endsWith('.docx')) {
        rawText = await extractDocx(buffer)
      } else if (IMAGE_MIMES.has(mime)) {
        rawText = await extractImage(buffer)
      } else {
        return errorResponse('PARSING_FAILED', `Unsupported file type: ${mime || file.name}`, 415)
      }
    } else {
      return errorResponse('EMPTY_CONTENT', 'Provide one of: text, url, or file', 400)
    }
  } catch (err) {
    if (err instanceof RecipeProcessingError) {
      return errorResponse(err.code, err.message, 422)
    }
    return errorResponse('PARSING_FAILED', publicMessage(err, 'Extraction failed'), 500)
  }

  try {
    const rawProvider = formData.get('provider')
    const validProviders: LLMProvider[] = ['anthropic', 'openai', 'ollama']
    const provider = typeof rawProvider === 'string' && validProviders.includes(rawProvider as LLMProvider)
      ? (rawProvider as LLMProvider)
      : undefined

    const recipe = await processRecipe(rawText, provider)
    return NextResponse.json(recipe)
  } catch (err) {
    if (err instanceof RecipeProcessingError) {
      return errorResponse(err.code, err.message, 422)
    }
    return errorResponse('AI_EXTRACTION_FAILED', publicMessage(err, 'Processing failed'), 500)
  }
}
