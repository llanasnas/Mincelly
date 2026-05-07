import { beforeEach, describe, expect, it, vi } from 'vitest'

const extractText = vi.fn(async (input: string) => `text:${input}`)
const extractDocx = vi.fn(async (input: string | Buffer) => `docx:${Buffer.isBuffer(input) ? 'buffer' : input}`)
const extractImage = vi.fn(async (input: string) => `image:${input}`)
const extractYoutube = vi.fn(async (input: string) => `youtube:${input}`)

vi.mock('@/lib/extractors/text', () => ({ extract: extractText }))
vi.mock('@/lib/extractors/docx', () => ({ extract: extractDocx }))
vi.mock('@/lib/extractors/image', () => ({ extract: extractImage }))
vi.mock('@/lib/extractors/youtube', () => ({ extract: extractYoutube }))

import { extract } from '@/lib/extractors'

describe('extractor router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes Buffers to the docx extractor', async () => {
    const result = await extract(Buffer.from('docx'))

    expect(result).toBe('docx:buffer')
    expect(extractDocx).toHaveBeenCalledOnce()
    expect(extractText).not.toHaveBeenCalled()
  })

  it('routes YouTube URLs to the youtube extractor', async () => {
    const input = 'https://youtu.be/dQw4w9WgXcQ'

    const result = await extract(input)

    expect(result).toBe(`youtube:${input}`)
    expect(extractYoutube).toHaveBeenCalledWith(input)
  })

  it('routes .docx paths to the docx extractor', async () => {
    const input = '/tmp/recipe.DOCX'

    const result = await extract(input)

    expect(result).toBe(`docx:${input}`)
    expect(extractDocx).toHaveBeenCalledWith(input)
  })

  it('routes supported image extensions to the image extractor', async () => {
    const input = '/tmp/recipe.webp'

    const result = await extract(input)

    expect(result).toBe(`image:${input}`)
    expect(extractImage).toHaveBeenCalledWith(input)
  })

  it('falls back to the text extractor for plain strings', async () => {
    const input = 'Ingredientes:\n- 2 huevos'

    const result = await extract(input)

    expect(result).toBe(`text:${input}`)
    expect(extractText).toHaveBeenCalledWith(input)
  })
})
