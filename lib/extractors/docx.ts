// Mammoth only runs in Node.js (no Edge runtime support).
// Any route handler that imports this file must also declare:
//   export const runtime = 'nodejs'
import mammoth from 'mammoth'
import { readFile } from 'fs/promises'
import { RecipeProcessingError } from '@/lib/errors'
import type { LLMProvider } from '@/lib/llm/types'
import { extract as extractImage } from './image'

/**
 * Below this much text, the document probably holds the recipe as a picture.
 * Common in practice: notes exported from OneNote or a phone scanner arrive as
 * a .docx with a title and one embedded photo of the page.
 */
const SPARSE_TEXT_CHARS = 200
/** Text this short is a heading at most — it cannot be the recipe. */
const TITLE_ONLY_CHARS = 60
/** Cap on vision calls per document. */
const MAX_IMAGES = 4

async function embeddedImages(buffer: Buffer): Promise<Buffer[]> {
  const images: Buffer[] = []
  // convertToHtml is the only mammoth API that hands out the embedded images;
  // the HTML itself is discarded.
  await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        images.push(await image.readAsBuffer())
        return { src: '' }
      }),
    },
  )
  return images
}

/** Reads the text off each embedded image. Images without readable text are skipped. */
async function readImages(images: Buffer[], provider?: LLMProvider): Promise<{ texts: string[]; error?: unknown }> {
  const results = await Promise.allSettled(images.slice(0, MAX_IMAGES).map((image) => extractImage(image, provider)))
  return {
    texts: results.flatMap((r) => (r.status === 'fulfilled' && r.value.trim() ? [r.value.trim()] : [])),
    error: results.find((r) => r.status === 'rejected')?.reason,
  }
}

/**
 * Docx extractor — returns the document's text, and when there is little of it,
 * also the text found in its embedded images (via the vision model).
 * @param input     File path (string) or raw file contents (Buffer).
 * @param provider  Vision provider for embedded images; defaults to the first configured one.
 */
export async function extract(input: string | Buffer, provider?: LLMProvider): Promise<string> {
  const buffer = Buffer.isBuffer(input) ? input : await readFile(input)

  let text: string
  let images: Buffer[] = []
  try {
    text = (await mammoth.extractRawText({ buffer })).value.trim()
    if (text.length < SPARSE_TEXT_CHARS) images = await embeddedImages(buffer)
  } catch (err) {
    throw new RecipeProcessingError(
      'PARSING_FAILED',
      'No se pudo leer el documento. Comprueba que es un archivo .docx válido.',
      err instanceof Error ? err.message : undefined,
    )
  }

  if (images.length > 0) {
    const { texts, error } = await readImages(images, provider)
    if (texts.length > 0) return [text, ...texts].filter(Boolean).join('\n\n')

    // Little more than a title, and the pictures could not be read: say why,
    // rather than sending a bare title to the model and getting an invented
    // recipe back.
    if (text.length < TITLE_ONLY_CHARS) {
      throw error instanceof RecipeProcessingError
        ? error
        : new RecipeProcessingError(
            'OCR_FAILED',
            'La receta está en una imagen dentro del documento y no se ha podido leer. Sube la foto directamente.',
          )
    }
  }

  if (!text) {
    throw new RecipeProcessingError('EMPTY_CONTENT', 'El documento no contiene texto.')
  }
  return text
}
