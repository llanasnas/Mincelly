import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ providers: vi.fn(() => [] as { id: string; label: string }[]) }))

vi.mock('@/lib/llm/provider', () => ({ getAvailableProviders: mocks.providers }))

import { detectMediaType, extract } from '@/lib/extractors/image'

const bytes = (...head: number[]) => Buffer.concat([Buffer.from(head), Buffer.alloc(16)])

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0)
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)])

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('detectMediaType', () => {
  it('recognises supported formats by their magic bytes', () => {
    expect(detectMediaType(PNG)).toBe('image/png')
    expect(detectMediaType(JPEG)).toBe('image/jpeg')
    expect(detectMediaType(GIF)).toBe('image/gif')
    expect(detectMediaType(WEBP)).toBe('image/webp')
  })

  // The declared MIME type is whatever the client says it is.
  it('returns null for anything that is not actually an image', () => {
    expect(detectMediaType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull()
    expect(detectMediaType(Buffer.from('%PDF-1.7 not an image at all'))).toBeNull()
    expect(detectMediaType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(8)]))).toBeNull()
    expect(detectMediaType(Buffer.alloc(4))).toBeNull()
  })
})

describe('image extractor', () => {
  it('rejects unsupported image data before calling any model', async () => {
    mocks.providers.mockReturnValue([{ id: 'ollama', label: 'Ollama' }])
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(extract(Buffer.from('definitely not an image'))).rejects.toMatchObject({ code: 'OCR_FAILED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails with OCR_FAILED when no AI provider is configured', async () => {
    mocks.providers.mockReturnValue([])

    await expect(extract(PNG)).rejects.toMatchObject({
      code: 'OCR_FAILED',
      message: expect.stringContaining('proveedor de IA'),
    })
  })

  it('uses the requested provider and returns its text', async () => {
    mocks.providers.mockReturnValue([{ id: 'anthropic', label: 'Claude' }])
    const fetchMock = vi.fn(async (_url: string) =>
      new Response(JSON.stringify({ message: { content: ' Ingredientes: 2 huevos ' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(extract(PNG, 'ollama')).resolves.toBe('Ingredientes: 2 huevos')
    expect(fetchMock.mock.calls[0][0]).toContain('/api/chat')
  })

  it('explains an unreachable Ollama instead of leaking a fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))

    await expect(extract(JPEG, 'ollama')).rejects.toMatchObject({
      code: 'OCR_FAILED',
      message: expect.stringContaining('[ollama]'),
      detail: 'fetch failed',
    })
  })

  it('tags an oversized image for Anthropic with a clear message', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)])

    await expect(extract(big, 'anthropic')).rejects.toMatchObject({
      code: 'OCR_FAILED',
      message: expect.stringMatching(/\[anthropic\].*5 MB/),
    })
  })
})
