import { YoutubeTranscript } from 'youtube-transcript'
import { RecipeProcessingError } from '@/lib/errors'

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/

/** Shorter than this, a transcript can't hold a recipe. */
const MIN_TRANSCRIPT_CHARS = 30

export function isYoutubeUrl(input: string): boolean {
  return YOUTUBE_RE.test(input)
}

// youtube-transcript uses an unofficial API and only reports failures as free-text
// messages, so the cause has to be inferred from the wording.
function explainFailure(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('disabled')) {
    return 'El propietario ha deshabilitado los subtítulos en este vídeo.'
  }
  if (lower.includes('unavailable') || lower.includes('private') || lower.includes('removed')) {
    return 'El vídeo no está disponible (privado, eliminado o restringido por región).'
  }
  if (lower.includes('age') || lower.includes('sign in')) {
    return 'El vídeo tiene restricción de edad y requiere autenticación.'
  }
  if (lower.includes('no transcript') || lower.includes('not available') || lower.includes('could not retrieve')) {
    return 'Este vídeo no tiene subtítulos disponibles. Activa los subtítulos o pega el texto manualmente.'
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('econn') || lower.includes('timeout')) {
    return 'Error de red al contactar con YouTube. Reintenta en unos segundos.'
  }
  return `No se pudo obtener la transcripción: ${msg.slice(0, 200)}`
}

/** YouTube extractor — returns the video's transcript as plain text. */
export async function extract(input: string): Promise<string> {
  const url = input.trim()
  if (!isYoutubeUrl(url)) {
    throw new RecipeProcessingError(
      'TRANSCRIPT_NOT_AVAILABLE',
      'URL de YouTube no válida. Formatos aceptados: youtube.com/watch?v=…, youtu.be/…, /shorts/…',
    )
  }

  let segments: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>>
  try {
    segments = await YoutubeTranscript.fetchTranscript(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    throw new RecipeProcessingError('TRANSCRIPT_NOT_AVAILABLE', explainFailure(msg), msg)
  }

  if (!segments || segments.length === 0) {
    throw new RecipeProcessingError(
      'TRANSCRIPT_NOT_AVAILABLE',
      'Este vídeo no tiene transcripción disponible. Pega el texto de la receta manualmente.',
    )
  }

  const text = segments.map((s) => s.text).join(' ').trim()
  if (text.length < MIN_TRANSCRIPT_CHARS) {
    throw new RecipeProcessingError(
      'TRANSCRIPT_NOT_AVAILABLE',
      'La transcripción es demasiado corta para extraer una receta. Pega el texto manualmente.',
    )
  }

  return text
}
