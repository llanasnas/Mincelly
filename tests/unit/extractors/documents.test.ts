import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeProcessingError } from '@/lib/errors'

const mocks = vi.hoisted(() => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
  extractRawText: vi.fn(),
  /** Images "embedded" in the docx under test. */
  docxImages: [] as Buffer[],
  extractImage: vi.fn(),
}))

vi.mock('unpdf', () => ({ getDocumentProxy: mocks.getDocumentProxy, extractText: mocks.extractText }))
vi.mock('@/lib/extractors/image', () => ({ extract: mocks.extractImage }))
vi.mock('mammoth', () => {
  type ImageHandler = (image: { readAsBuffer: () => Promise<Buffer> }) => Promise<unknown>
  return {
    default: {
      extractRawText: mocks.extractRawText,
      images: { imgElement: (handler: ImageHandler) => handler },
      // Mimics mammoth: calls the image handler once per embedded image.
      convertToHtml: async (_input: unknown, options: { convertImage: ImageHandler }) => {
        for (const image of mocks.docxImages) {
          await options.convertImage({ readAsBuffer: async () => image })
        }
        return { value: '', messages: [] }
      },
    },
  }
})

import { extract as extractPdf } from '@/lib/extractors/pdf'
import { extract as extractDocx } from '@/lib/extractors/docx'

const file = Buffer.from('file bytes')
const photo = (label: string) => Buffer.from(`photo:${label}`)
const rawText = (value: string) => mocks.extractRawText.mockResolvedValue({ value, messages: [] })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.docxImages.length = 0
  mocks.getDocumentProxy.mockResolvedValue({})
})

describe('pdf extractor', () => {
  it('returns the merged, trimmed text layer', async () => {
    mocks.extractText.mockResolvedValue({ totalPages: 2, text: '  Flan de huevo\nIngredientes: 4 huevos, 500 ml de leche  ' })

    await expect(extractPdf(file)).resolves.toBe('Flan de huevo\nIngredientes: 4 huevos, 500 ml de leche')
    expect(mocks.extractText).toHaveBeenCalledWith(expect.anything(), { mergePages: true })
  })

  // A scan has pages but no text layer; that needs OCR, i.e. the image path.
  it('tells scanned PDFs apart and points to the photo upload', async () => {
    mocks.extractText.mockResolvedValue({ totalPages: 1, text: ' \n ' })

    await expect(extractPdf(file)).rejects.toMatchObject({
      code: 'OCR_FAILED',
      message: expect.stringContaining('escaneado'),
    })
  })

  it('maps a corrupt or encrypted file to PARSING_FAILED with the cause as detail', async () => {
    mocks.getDocumentProxy.mockRejectedValue(new Error('Invalid PDF structure'))

    await expect(extractPdf(file)).rejects.toMatchObject({
      code: 'PARSING_FAILED',
      detail: 'Invalid PDF structure',
    })
  })
})

describe('docx extractor — text documents', () => {
  const longRecipe = `Caldo de verduras\n${'Ingredientes y pasos detallados. '.repeat(10)}`.trim()

  it('returns the trimmed document text', async () => {
    rawText(`\n ${longRecipe} \n`)

    await expect(extractDocx(file)).resolves.toBe(longRecipe)
  })

  it('does not spend vision calls on a document that already has its text', async () => {
    rawText(longRecipe)
    mocks.docxImages.push(photo('plato terminado'))

    await extractDocx(file)

    expect(mocks.extractImage).not.toHaveBeenCalled()
  })

  it('reports an empty document instead of sending nothing to the model', async () => {
    rawText('   ')

    await expect(extractDocx(file)).rejects.toMatchObject({ code: 'EMPTY_CONTENT' })
  })

  it('maps an unreadable file to PARSING_FAILED', async () => {
    mocks.extractRawText.mockRejectedValue(new Error("Can't find end of central directory"))

    await expect(extractDocx(file)).rejects.toMatchObject({
      code: 'PARSING_FAILED',
      detail: "Can't find end of central directory",
    })
  })
})

// Notes exported from OneNote or a phone scanner: a title, and the recipe as a photo.
describe('docx extractor — recipe embedded as an image', () => {
  it('reads the embedded image and appends its text to the title', async () => {
    rawText('CALDO DE VERDURAS')
    mocks.docxImages.push(photo('página'))
    mocks.extractImage.mockResolvedValue('Ingredientes: 2 zanahorias, 1 puerro…')

    await expect(extractDocx(file, 'openai')).resolves.toBe(
      'CALDO DE VERDURAS\n\nIngredientes: 2 zanahorias, 1 puerro…',
    )
    expect(mocks.extractImage).toHaveBeenCalledWith(photo('página'), 'openai')
  })

  it('reads several images, skipping the ones without text', async () => {
    rawText('')
    mocks.docxImages.push(photo('1'), photo('logo'), photo('2'))
    mocks.extractImage
      .mockResolvedValueOnce('Ingredientes…')
      .mockRejectedValueOnce(new RecipeProcessingError('OCR_FAILED', 'sin texto'))
      .mockResolvedValueOnce('Preparación…')

    await expect(extractDocx(file)).resolves.toBe('Ingredientes…\n\nPreparación…')
  })

  it('caps the number of vision calls per document', async () => {
    rawText('Recetario')
    for (let i = 0; i < 10; i++) mocks.docxImages.push(photo(String(i)))
    mocks.extractImage.mockResolvedValue('texto')

    await extractDocx(file)

    expect(mocks.extractImage).toHaveBeenCalledTimes(4)
  })

  // Sending just "CALDO DE VERDURAS" to the model makes it invent a recipe.
  it('fails with the OCR error instead of passing a bare title on', async () => {
    rawText('CALDO DE VERDURAS')
    mocks.docxImages.push(photo('página'))
    mocks.extractImage.mockRejectedValue(
      new RecipeProcessingError('OCR_FAILED', 'Leer recetas desde una imagen requiere un proveedor de IA configurado.'),
    )

    await expect(extractDocx(file)).rejects.toMatchObject({
      code: 'OCR_FAILED',
      message: expect.stringContaining('proveedor de IA'),
    })
  })

  it('still fails clearly when the image error is unexpected', async () => {
    rawText('Título')
    mocks.docxImages.push(photo('página'))
    mocks.extractImage.mockRejectedValue(new TypeError('boom'))

    await expect(extractDocx(file)).rejects.toMatchObject({ code: 'OCR_FAILED' })
  })

  it('keeps a short but real text when its only image has nothing to read', async () => {
    const shortRecipe = 'Vinagreta: 3 partes de aceite, 1 de vinagre, sal. Emulsionar batiendo.'
    rawText(shortRecipe)
    mocks.docxImages.push(photo('logo'))
    mocks.extractImage.mockRejectedValue(new RecipeProcessingError('OCR_FAILED', 'sin texto'))

    await expect(extractDocx(file)).resolves.toBe(shortRecipe)
  })
})
