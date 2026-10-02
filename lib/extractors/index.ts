/**
 * Extractor router — works out what kind of input it was given and delegates to
 * the matching extractor. Every extractor returns the recipe as plain text.
 */
import { extname } from 'path'
import type { LLMProvider } from '@/lib/llm/types'
import { extract as extractText } from './text'
import { extract as extractDocx } from './docx'
import { extract as extractPdf } from './pdf'
import { extract as extractImage } from './image'
import { extract as extractYoutube, isYoutubeUrl } from './youtube'

export type FileKind = 'docx' | 'pdf' | 'image'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

/**
 * Classifies an uploaded file. The extension is checked as well as the MIME type
 * because mobile browsers often send an empty or generic type for documents.
 */
export function detectFileKind(file: { name: string; type: string }): FileKind | null {
  const ext = extname(file.name).toLowerCase()
  if (file.type === DOCX_MIME || ext === '.docx') return 'docx'
  if (file.type === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (IMAGE_MIMES.has(file.type) || IMAGE_EXTENSIONS.has(ext)) return 'image'
  return null
}

export async function extractFile(kind: FileKind, buffer: Buffer, provider?: LLMProvider): Promise<string> {
  switch (kind) {
    case 'docx': return extractDocx(buffer, provider)
    case 'pdf': return extractPdf(buffer)
    case 'image': return extractImage(buffer, provider)
  }
}

/**
 * Extracts from a string that is either a YouTube URL, a file path, or the
 * recipe text itself. A bare Buffer is assumed to be a .docx.
 */
export async function extract(input: string | Buffer): Promise<string> {
  if (Buffer.isBuffer(input)) return extractDocx(input)
  if (isYoutubeUrl(input)) return extractYoutube(input)

  const ext = extname(input).toLowerCase()
  if (ext === '.docx') return extractDocx(input)
  if (ext === '.pdf') return extractPdf(input)
  if (IMAGE_EXTENSIONS.has(ext)) return extractImage(input)

  return extractText(input)
}
