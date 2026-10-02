import { readFile } from 'fs/promises'
import { extractText, getDocumentProxy } from 'unpdf'
import { RecipeProcessingError } from '@/lib/errors'

/** Below this, the PDF is almost certainly a scan with no text layer. */
const MIN_TEXT_CHARS = 30

/**
 * PDF extractor — reads the text layer of a PDF.
 * Scanned PDFs have no text layer; those need the image path (OCR) instead.
 * @param input  File path (string) or raw file contents (Buffer).
 */
export async function extract(input: string | Buffer): Promise<string> {
  const buffer = Buffer.isBuffer(input) ? input : await readFile(input)

  let text: string
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    text = (await extractText(pdf, { mergePages: true })).text.trim()
  } catch (err) {
    throw new RecipeProcessingError(
      'PARSING_FAILED',
      'No se pudo leer el PDF. Comprueba que el archivo no está dañado ni protegido con contraseña.',
      err instanceof Error ? err.message : undefined,
    )
  }

  if (text.length < MIN_TEXT_CHARS) {
    throw new RecipeProcessingError(
      'OCR_FAILED',
      'El PDF no contiene texto seleccionable (parece escaneado). Sube una foto o captura de la receta.',
    )
  }
  return text
}
