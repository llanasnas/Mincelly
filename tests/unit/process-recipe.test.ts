import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  providers: vi.fn(() => [{ id: 'anthropic', label: 'Claude' }]),
  complete: vi.fn(),
  byName: vi.fn(),
  computeNutrition: vi.fn(),
}))

vi.mock('@/lib/llm/provider', () => ({
  getAvailableProviders: mocks.providers,
  getLLMProvider: () => ({ complete: mocks.complete }),
  getLLMProviderByName: mocks.byName,
}))
vi.mock('@/lib/nutrition/engine', () => ({ computeNutrition: mocks.computeNutrition }))

import { processRecipe } from '@/lib/process-recipe'

const llmRecipe = {
  title: 'Tortilla de patatas',
  servings: 4,
  type: 'cocina',
  categories: ['Primeros'],
  ingredients: [
    { name: 'Patatas', quantity: '500 g', unit: null, normalized: 'patata', nameEn: 'potato', grams: 500 },
    { name: 'Huevos', quantity: '4', unit: null, normalized: 'huevo', nameEn: 'egg', grams: 220 },
  ],
  steps: [{ order: 1, instruction: 'Freír las patatas y cuajar con el huevo.' }],
  tags: [],
  confidence: 'high',
  warnings: ['Valores nutricionales estimados a partir de la composición típica del plato'],
  nutrition: { calories: 150 },
  cookingYield: 0.9,
}

const reply = (text: string) => ({ text, provider: 'anthropic', model: 'test' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.providers.mockReturnValue([{ id: 'anthropic', label: 'Claude' }])
  mocks.byName.mockReturnValue({ complete: mocks.complete })
  mocks.complete.mockResolvedValue(reply(JSON.stringify(llmRecipe)))
  mocks.computeNutrition.mockResolvedValue({
    nutrition: { calories: 142 },
    meta: { source: 'usda', coverage: 1, notes: [] },
  })
})

describe('processRecipe', () => {
  it('rejects empty input without calling the model', async () => {
    await expect(processRecipe('   ')).rejects.toMatchObject({ code: 'EMPTY_CONTENT' })
    expect(mocks.complete).not.toHaveBeenCalled()
  })

  it('returns a validated recipe with computed nutrition', async () => {
    const recipe = await processRecipe('Tortilla: 500 g patatas, 4 huevos…')

    expect(recipe.title).toBe('Tortilla de patatas')
    // unit glued to the quantity is split out
    expect(recipe.ingredients[0]).toMatchObject({ quantity: '500', unit: 'g', nameEn: 'potato', grams: 500 })
    expect(recipe.nutrition).toEqual({ calories: 142 })
    expect(recipe.nutritionMeta).toMatchObject({ source: 'usda', coverage: 1 })
  })

  it('hands the model’s own estimate to the engine as a cross-check', async () => {
    await processRecipe('Tortilla…')

    const [recipe, options] = mocks.computeNutrition.mock.calls[0]
    expect(recipe.cookingYield).toBe(0.9)
    expect(options).toMatchObject({ dishEstimate: { calories: 150 } })
  })

  it('drops the model’s nutrition disclaimers once the engine has taken over', async () => {
    const recipe = await processRecipe('Tortilla…')
    expect(recipe.warnings).toEqual([])
  })

  it('warns when no nutrition could be worked out at all', async () => {
    mocks.computeNutrition.mockResolvedValue({})

    const recipe = await processRecipe('Tortilla…')

    expect(recipe.nutrition).toBeUndefined()
    expect(recipe.warnings).toEqual(['No se pudieron calcular los valores nutricionales'])
  })

  it('sends the system prompt without its maintenance notes, and asks for JSON', async () => {
    await processRecipe('Tortilla…')

    const [messages, options] = mocks.complete.mock.calls[0]
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('CATEGORÍAS COCINA')
    expect(messages[0].content).not.toContain('<!--')
    expect(messages[1]).toEqual({ role: 'user', content: 'Tortilla…' })
    expect(options).toMatchObject({ temperature: 0, jsonMode: true, maxTokens: 8192 })
  })

  it('strips control characters and caps the input length', async () => {
    await processRecipe(`Tortilla\u0000\u0007 de\u001b patatas\n${'x'.repeat(60_000)}`)

    const sent = mocks.complete.mock.calls[0][0][1].content as string
    expect(sent.startsWith('Tortilla de patatas\n')).toBe(true)
    expect(sent.length).toBeLessThanOrEqual(50_000)
    expect(sent.length).toBeGreaterThan(49_990)
  })

  it('uses the provider the user picked', async () => {
    await processRecipe('Tortilla…', 'openai')

    expect(mocks.byName).toHaveBeenCalledWith('openai')
    expect(mocks.computeNutrition.mock.calls[0][1]).toMatchObject({ provider: 'openai' })
  })

  it('accepts fenced JSON wrapped under a "receta" key with Spanish field names', async () => {
    const quirky = {
      receta: {
        nombre: 'Gazpacho',
        ingredientes: { tomate: '1 kg', ajo: 1 },
        pasos: ['Triturar todo', 'Enfriar'],
      },
    }
    mocks.complete.mockResolvedValue(reply('Aquí tienes:\n```json\n' + JSON.stringify(quirky) + '\n```'))

    const recipe = await processRecipe('Gazpacho…')

    expect(recipe.title).toBe('Gazpacho')
    expect(recipe.ingredients).toEqual([
      { name: 'tomate', quantity: '1', unit: 'kg' },
      { name: 'ajo', quantity: '1' },
    ])
    expect(recipe.steps.map((s) => s.order)).toEqual([1, 2])
  })

  it('maps a provider failure to AI_EXTRACTION_FAILED, keeping the cause as detail', async () => {
    mocks.complete.mockRejectedValue(new Error('529 overloaded_error'))

    await expect(processRecipe('Tortilla…')).rejects.toMatchObject({
      code: 'AI_EXTRACTION_FAILED',
      detail: '529 overloaded_error',
    })
  })

  it('reports non-JSON output as PARSING_FAILED, naming the provider', async () => {
    mocks.complete.mockResolvedValue(reply('Lo siento, no puedo procesar esa receta.'))

    await expect(processRecipe('Tortilla…')).rejects.toMatchObject({
      code: 'PARSING_FAILED',
      message: expect.stringContaining('[anthropic]'),
    })
  })

  it('recognises a response cut off by the token limit', async () => {
    mocks.complete.mockResolvedValue(reply('{"title":"Cocido","ingredients":[{"name":"garbanz'))

    await expect(processRecipe('Cocido…')).rejects.toMatchObject({
      code: 'PARSING_FAILED',
      message: expect.stringContaining('se cortó'),
    })
  })

  it('reports schema violations with the raw output as detail only', async () => {
    mocks.complete.mockResolvedValue(reply(JSON.stringify({ ...llmRecipe, confidence: 'altísima' })))

    const error = await processRecipe('Tortilla…').catch((e) => e)

    expect(error).toMatchObject({ code: 'AI_EXTRACTION_FAILED' })
    expect(error.message).not.toContain('altísima')
    expect(error.detail).toContain('confidence')
  })

  it('fails loudly when the model finds no ingredients or steps — no silent fallback', async () => {
    mocks.complete.mockResolvedValue(reply(JSON.stringify({ ...llmRecipe, title: 'Contenido no reconocido', ingredients: [] })))
    await expect(processRecipe('hola qué tal')).rejects.toMatchObject({
      code: 'AI_EXTRACTION_FAILED',
      message: expect.stringContaining('ingredientes'),
    })

    mocks.complete.mockResolvedValue(reply(JSON.stringify({ ...llmRecipe, steps: [] })))
    await expect(processRecipe('solo ingredientes')).rejects.toMatchObject({
      message: expect.stringContaining('pasos'),
    })
    expect(mocks.computeNutrition).not.toHaveBeenCalled()
  })

  it('uses the heuristic parser when no AI provider is configured', async () => {
    mocks.providers.mockReturnValue([])

    const recipe = await processRecipe('Flan\nIngredientes:\n- 4 huevos\n- 500 ml leche\nPreparación:\n- Mezclar y hornear')

    expect(mocks.complete).not.toHaveBeenCalled()
    expect(recipe.title).toBe('Flan')
    expect(recipe.ingredients[1]).toMatchObject({ quantity: '500', unit: 'ml', name: 'leche' })
    expect(recipe.confidence).toBe('low')
    // nutrition still goes through the engine (databases only)
    expect(mocks.computeNutrition).toHaveBeenCalledOnce()
    expect(recipe.nutrition).toEqual({ calories: 142 })
  })
})
