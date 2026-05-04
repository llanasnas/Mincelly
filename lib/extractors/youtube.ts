import { YoutubeTranscript } from 'youtube-transcript'
import { RecipeProcessingError } from '@/lib/errors'

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/

function classifyError(msg: string): { code: 'TRANSCRIPT_NOT_AVAILABLE'; reason: string } {
  const lower = msg.toLowerCase()
  if (lower.includes('disabled') || lower.includes('transcript is disabled')) {
    return { code: 'TRANSCRIPT_NOT_AVAILABLE', reason: 'El propietario ha deshabilitado los subtítulos en este vídeo.' }
  }
  if (lower.includes('unavailable') || lower.includes('private') || lower.includes('removed')) {
    return { code: 'TRANSCRIPT_NOT_AVAILABLE', reason: 'El vídeo no está disponible (privado, eliminado o restringido por región).' }
  }
  if (lower.includes('age') || lower.includes('sign in')) {
    return { code: 'TRANSCRIPT_NOT_AVAILABLE', reason: 'El vídeo tiene restricción de edad y requiere autenticación.' }
  }
  if (lower.includes('no transcript') || lower.includes('not available') || lower.includes('could not retrieve')) {
    return { code: 'TRANSCRIPT_NOT_AVAILABLE', reason: 'Este vídeo no tiene subtítulos disponibles. Activa los subtítulos o pega el texto manualmente.' }
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('econn') || lower.includes('timeout')) {
    return { code: 'TRANSCRIPT_NOT_AVAILABLE', reason: 'Error de red al contactar con YouTube. Reintenta en unos segundos.' }
  }
  return { code: 'TRANSCRIPT_NOT_AVAILABLE', reason: `No se pudo obtener la transcripción: ${msg.slice(0, 200)}` }
}

export async function extract(input: string): Promise<string> {
  const trimmed = input.trim()
  if (!YOUTUBE_RE.test(trimmed)) {
    throw new RecipeProcessingError(
      'TRANSCRIPT_NOT_AVAILABLE',
      'URL de YouTube no válida. Formatos aceptados: youtube.com/watch?v=…, youtu.be/…, /shorts/…'
    )
  }

  let segments: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>>
  try {
    segments = await YoutubeTranscript.fetchTranscript(trimmed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    const { reason } = classifyError(msg)
    throw new RecipeProcessingError('TRANSCRIPT_NOT_AVAILABLE', reason)
  }

  if (!segments || segments.length === 0) {
    throw new RecipeProcessingError(
      'TRANSCRIPT_NOT_AVAILABLE',
      'Este vídeo no tiene transcripción disponible. Pega el texto de la receta manualmente.',
    )
  }

  const text = segments.map((s) => s.text).join(' ').trim()
  if (text.length < 30) {
    throw new RecipeProcessingError(
      'TRANSCRIPT_NOT_AVAILABLE',
      'La transcripción es demasiado corta para extraer una receta. Pega el texto manualmente.',
    )
  }

  return text
}
