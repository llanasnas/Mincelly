import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { readFile } from 'fs/promises'
import { RecipeProcessingError } from '@/lib/errors'
import { getAvailableProviders } from '@/lib/llm/provider'
import type { LLMProvider } from '@/lib/llm/types'

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

/** Identifies an image by its magic bytes. Returns null for anything we can't send to a vision model. */
export function detectMediaType(buf: Buffer): ImageMediaType | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

const EXTRACT_PROMPT =
  'Extract all recipe text from this image. Return only the raw text content — ' +
  'ingredients, steps, quantities — exactly as written, without any formatting or commentary.'

// Anthropic rejects images larger than 5MB (base64-decoded). The /api/process
// route allows more than that, so guard here with a clear, provider-tagged message.
const ANTHROPIC_MAX_IMAGE_BYTES = 5 * 1024 * 1024

function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function extractWithAnthropic(buffer: Buffer, mediaType: ImageMediaType): Promise<string> {
  if (buffer.byteLength > ANTHROPIC_MAX_IMAGE_BYTES) {
    const mb = (buffer.byteLength / 1024 / 1024).toFixed(1)
    throw new RecipeProcessingError(
      'OCR_FAILED',
      `[anthropic] La imagen pesa ${mb} MB y el máximo es 5 MB. Reduce la resolución de la foto e inténtalo de nuevo.`,
    )
  }

  const client = new Anthropic()
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

  let response
  try {
    response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
          },
          { type: 'text', text: EXTRACT_PROMPT },
        ],
      }],
    })
  } catch (err) {
    throw new RecipeProcessingError('OCR_FAILED', '[anthropic] No se pudo leer la imagen.', errorDetail(err))
  }

  const block = response.content[0]
  if (!block || block.type !== 'text' || !block.text.trim()) {
    throw new RecipeProcessingError('OCR_FAILED', '[anthropic] No se ha encontrado texto en la imagen.')
  }
  return block.text
}

async function extractWithOpenAI(buffer: Buffer, mediaType: ImageMediaType): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new RecipeProcessingError('OCR_FAILED', '[openai] Falta configurar OPENAI_API_KEY.')
  }

  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'
  const dataUrl = `data:${mediaType};base64,${buffer.toString('base64')}`

  let response
  try {
    response = await client.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: EXTRACT_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    })
  } catch (err) {
    throw new RecipeProcessingError('OCR_FAILED', '[openai] No se pudo leer la imagen.', errorDetail(err))
  }

  const text = response.choices[0]?.message?.content?.trim()
  if (!text) throw new RecipeProcessingError('OCR_FAILED', '[openai] No se ha encontrado texto en la imagen.')
  return text
}

async function extractWithOllama(buffer: Buffer): Promise<string> {
  const model = process.env.OLLAMA_VISION_MODEL ?? process.env.OLLAMA_MODEL ?? 'llama3.2-vision'
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{
          role: 'user',
          content: EXTRACT_PROMPT,
          images: [buffer.toString('base64')],
        }],
      }),
    })
  } catch (err) {
    throw new RecipeProcessingError(
      'OCR_FAILED',
      `[ollama] No se pudo conectar con Ollama en ${baseUrl}. ¿Está en marcha?`,
      errorDetail(err),
    )
  }

  if (!res.ok) {
    throw new RecipeProcessingError(
      'OCR_FAILED',
      `[ollama] Error ${res.status}. ¿Está instalado ${model}? Ejecuta: ollama pull ${model}`,
    )
  }

  const json = (await res.json()) as { message?: { content?: string } }
  const text = json.message?.content?.trim()
  if (!text) throw new RecipeProcessingError('OCR_FAILED', '[ollama] No se ha encontrado texto en la imagen.')
  return text
}

/**
 * Image extractor — reads the recipe text off a photo with a vision model.
 * @param input     File path (string) or raw file contents (Buffer).
 * @param provider  Vision provider to use; defaults to the first configured one.
 */
export async function extract(input: string | Buffer, provider?: LLMProvider): Promise<string> {
  const buffer = Buffer.isBuffer(input) ? input : await readFile(input)

  const mediaType = detectMediaType(buffer)
  if (!mediaType) {
    throw new RecipeProcessingError(
      'OCR_FAILED',
      'Formato de imagen no compatible. Usa JPG, PNG o WebP.',
    )
  }

  const active = provider ?? getAvailableProviders()[0]?.id
  switch (active) {
    case 'ollama': return extractWithOllama(buffer)
    case 'openai': return extractWithOpenAI(buffer, mediaType)
    case 'anthropic': return extractWithAnthropic(buffer, mediaType)
    default:
      // NON-AI MODE has no OCR engine.
      throw new RecipeProcessingError(
        'OCR_FAILED',
        'Leer recetas desde una imagen requiere un proveedor de IA configurado.',
      )
  }
}
