import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeProcessingError } from '@/lib/errors'

const mocks = vi.hoisted(() => ({
  fetchTranscript: vi.fn(),
}))

vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: mocks.fetchTranscript,
  },
}))

import { extract } from '@/lib/extractors/youtube'

describe('youtube extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid YouTube URLs before calling the API', async () => {
    await expect(extract('https://example.com/video')).rejects.toMatchObject({
      code: 'TRANSCRIPT_NOT_AVAILABLE',
      message: expect.stringContaining('URL de YouTube no válida'),
    })

    expect(mocks.fetchTranscript).not.toHaveBeenCalled()
  })

  it('joins transcript segments into plain text', async () => {
    mocks.fetchTranscript.mockResolvedValueOnce([
      { text: 'Ingredientes para la receta' },
      { text: 'mezclar todo y hornear despacio' },
    ])

    await expect(extract('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).resolves.toBe(
      'Ingredientes para la receta mezclar todo y hornear despacio',
    )
  })

  it('maps disabled subtitles errors to a user-friendly message', async () => {
    mocks.fetchTranscript.mockRejectedValueOnce(new Error('Transcript is disabled for this video'))

    await expect(extract('https://youtu.be/dQw4w9WgXcQ')).rejects.toEqual(
      expect.objectContaining({
        code: 'TRANSCRIPT_NOT_AVAILABLE',
        message: 'El propietario ha deshabilitado los subtítulos en este vídeo.',
      }),
    )
  })

  it('treats empty transcript responses as unavailable', async () => {
    mocks.fetchTranscript.mockResolvedValueOnce([])

    await expect(extract('https://youtu.be/dQw4w9WgXcQ')).rejects.toEqual(
      expect.objectContaining({
        code: 'TRANSCRIPT_NOT_AVAILABLE',
        message: 'Este vídeo no tiene transcripción disponible. Pega el texto de la receta manualmente.',
      }),
    )
  })

  it('rejects transcripts that are too short to parse as a recipe', async () => {
    mocks.fetchTranscript.mockResolvedValueOnce([{ text: 'Muy corta' }])

    const promise = extract('https://youtu.be/dQw4w9WgXcQ')

    await expect(promise).rejects.toBeInstanceOf(RecipeProcessingError)
    await expect(promise).rejects.toMatchObject({
      code: 'TRANSCRIPT_NOT_AVAILABLE',
      message: 'La transcripción es demasiado corta para extraer una receta. Pega el texto manualmente.',
    })
  })

  it('classifies network-style upstream failures', async () => {
    mocks.fetchTranscript.mockRejectedValueOnce(new Error('network timeout'))

    await expect(extract('https://youtu.be/dQw4w9WgXcQ')).rejects.toMatchObject({
      code: 'TRANSCRIPT_NOT_AVAILABLE',
      message: 'Error de red al contactar con YouTube. Reintenta en unos segundos.',
    })
  })
})
