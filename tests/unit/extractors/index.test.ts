import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  extractText: vi.fn(async (input: string) => `text:${input}`),
  extractDocx: vi.fn(async (input: string | Buffer) => `docx:${Buffer.isBuffer(input) ? 'buffer' : input}`),
  extractPdf: vi.fn(async (input: string | Buffer) => `pdf:${Buffer.isBuffer(input) ? 'buffer' : input}`),
  extractImage: vi.fn(async (input: string | Buffer, provider?: string) =>
    `image:${Buffer.isBuffer(input) ? 'buffer' : input}:${provider ?? 'default'}`),
  extractYoutube: vi.fn(async (input: string) => `youtube:${input}`),
}))

vi.mock('@/lib/extractors/text', () => ({ extract: mocks.extractText }))
vi.mock('@/lib/extractors/docx', () => ({ extract: mocks.extractDocx }))
vi.mock('@/lib/extractors/pdf', () => ({ extract: mocks.extractPdf }))
vi.mock('@/lib/extractors/image', () => ({ extract: mocks.extractImage }))
vi.mock('@/lib/extractors/youtube', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/extractors/youtube')>()),
  extract: mocks.extractYoutube,
}))

import { detectFileKind, extract, extractFile } from '@/lib/extractors'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractor router', () => {
  it('routes Buffers to the docx extractor', async () => {
    const result = await extract(Buffer.from('docx'))

    expect(result).toBe('docx:buffer')
    expect(mocks.extractDocx).toHaveBeenCalledOnce()
    expect(mocks.extractText).not.toHaveBeenCalled()
  })

  it('routes YouTube URLs to the youtube extractor', async () => {
    const input = 'https://youtu.be/dQw4w9WgXcQ'

    const result = await extract(input)

    expect(result).toBe(`youtube:${input}`)
    expect(mocks.extractYoutube).toHaveBeenCalledWith(input)
  })

  it('routes .docx paths to the docx extractor', async () => {
    const input = '/tmp/recipe.DOCX'

    const result = await extract(input)

    expect(result).toBe(`docx:${input}`)
    expect(mocks.extractDocx).toHaveBeenCalledWith(input)
  })

  it('routes .pdf paths to the pdf extractor', async () => {
    expect(await extract('/tmp/recipe.pdf')).toBe('pdf:/tmp/recipe.pdf')
  })

  it('routes supported image extensions to the image extractor', async () => {
    const input = '/tmp/recipe.webp'

    const result = await extract(input)

    expect(result).toBe(`image:${input}:default`)
    expect(mocks.extractImage).toHaveBeenCalledWith(input)
  })

  it('falls back to the text extractor for plain strings', async () => {
    const input = 'Ingredientes:\n- 2 huevos'

    const result = await extract(input)

    expect(result).toBe(`text:${input}`)
    expect(mocks.extractText).toHaveBeenCalledWith(input)
  })
})

describe('detectFileKind', () => {
  it('classifies by MIME type', () => {
    expect(detectFileKind({ name: 'receta', type: DOCX_MIME })).toBe('docx')
    expect(detectFileKind({ name: 'receta', type: 'application/pdf' })).toBe('pdf')
    expect(detectFileKind({ name: 'foto', type: 'image/jpeg' })).toBe('image')
    expect(detectFileKind({ name: 'foto', type: 'image/webp' })).toBe('image')
  })

  // Mobile browsers frequently send no type (or application/octet-stream) for documents.
  it('falls back to the extension when the MIME type is missing or generic', () => {
    expect(detectFileKind({ name: 'CALDO DE VERDURAS.DOCX', type: '' })).toBe('docx')
    expect(detectFileKind({ name: 'receta.pdf', type: 'application/octet-stream' })).toBe('pdf')
    expect(detectFileKind({ name: 'IMG_0042.JPG', type: '' })).toBe('image')
  })

  it('rejects everything else', () => {
    expect(detectFileKind({ name: 'receta.doc', type: 'application/msword' })).toBeNull()
    expect(detectFileKind({ name: 'foto.heic', type: 'image/heic' })).toBeNull()
    expect(detectFileKind({ name: 'script.exe', type: 'application/x-msdownload' })).toBeNull()
    expect(detectFileKind({ name: 'sin-extension', type: '' })).toBeNull()
  })
})

describe('extractFile', () => {
  const buffer = Buffer.from('bytes')

  it('dispatches each kind to its extractor', async () => {
    expect(await extractFile('docx', buffer)).toBe('docx:buffer')
    expect(await extractFile('pdf', buffer)).toBe('pdf:buffer')
    expect(await extractFile('image', buffer)).toBe('image:buffer:default')
  })

  it('passes the chosen provider on to the vision extractor', async () => {
    expect(await extractFile('image', buffer, 'openai')).toBe('image:buffer:openai')
  })
})
