import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ingredient } from '@/lib/schema'
import { emptyProfile, type NutrientProfile } from '@/lib/nutrition/types'

const mocks = vi.hoisted(() => ({
  findFood: vi.fn(),
  usdaConfigured: vi.fn(() => true),
  estimateIngredients: vi.fn(),
  providers: vi.fn(() => [{ id: 'anthropic', label: 'Claude' }]),
}))

vi.mock('@/lib/nutrition/usda', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nutrition/usda')>()),
  findFood: mocks.findFood,
  isUSDAConfigured: mocks.usdaConfigured,
}))
vi.mock('@/lib/nutrition/llm-estimates', () => ({ estimateIngredients: mocks.estimateIngredients }))
vi.mock('@/lib/llm/provider', () => ({ getAvailableProviders: mocks.providers }))

import { computeNutrition } from '@/lib/nutrition/engine'
import { USDAError } from '@/lib/nutrition/usda'

const profile = (values: Partial<NutrientProfile>): NutrientProfile => ({ ...emptyProfile(), alcohol: 0, ...values })

const recipe = (ingredients: Ingredient[], extra: { servings?: number; cookingYield?: number } = {}) => ({
  title: 'Receta de prueba',
  ingredients,
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.usdaConfigured.mockReturnValue(true)
  mocks.providers.mockReturnValue([{ id: 'anthropic', label: 'Claude' }])
  mocks.findFood.mockResolvedValue(null)
  mocks.estimateIngredients.mockResolvedValue(new Map())
})

describe('computeNutrition — bundled reference data', () => {
  it('computes per-100 g values without any network call for pantry staples', async () => {
    // 100 g of olive oil (884 kcal, 100 g fat) + 100 g of water = 200 g.
    const { nutrition, meta } = await computeNutrition(
      recipe([
        { name: 'Aceite de oliva', quantity: '100', unit: 'g', normalized: 'aceite de oliva' },
        { name: 'Agua', quantity: '100', unit: 'ml', normalized: 'agua' },
      ]),
    )

    expect(nutrition).toMatchObject({ calories: 442, fat: 50, protein: 0, carbohydrates: 0 })
    expect(nutrition!.water).toBeCloseTo(50, 0)
    expect(nutrition!.dryExtract).toBeCloseTo(50, 0)
    expect(meta).toMatchObject({ source: 'usda', coverage: 1, totalWeight: 200 })
    expect(meta!.notes).toEqual([])
    expect(mocks.findFood).not.toHaveBeenCalled()
    expect(mocks.estimateIngredients).not.toHaveBeenCalled()
  })

  it('reports each ingredient’s contribution in recipe order', async () => {
    const { meta } = await computeNutrition(
      recipe([
        { name: 'Azúcar', quantity: '50', unit: 'g', normalized: 'azúcar' },
        { name: 'Huevos', quantity: '2', normalized: 'huevo' },
      ]),
    )

    expect(meta!.breakdown).toEqual([
      { name: 'Azúcar', grams: 50, calories: 194, source: 'reference', match: 'Sugars, granulated' },
      { name: 'Huevos', grams: 110, calories: 157, source: 'reference', match: 'Egg, whole, raw, fresh' },
    ])
  })
})

describe('computeNutrition — weights', () => {
  it('converts units as the recipe wrote them', async () => {
    const { meta } = await computeNutrition(
      recipe([{ name: 'Aceite de oliva', quantity: '2', unit: 'cucharadas', normalized: 'aceite de oliva' }]),
    )
    expect(meta!.breakdown![0].grams).toBeCloseTo(27.6, 1)
  })

  it('trusts an exact unit conversion over the model’s weight estimate', async () => {
    const { meta } = await computeNutrition(
      recipe([{ name: 'Harina', quantity: '250', unit: 'g', normalized: 'harina', grams: 999 }]),
    )
    expect(meta!.breakdown![0].grams).toBe(250)
  })

  it('uses the model’s estimate for counted ingredients', async () => {
    const { meta } = await computeNutrition(
      recipe([{ name: 'Cebolla grande', quantity: '1', normalized: 'cebolla', grams: 220 }]),
    )
    expect(meta!.breakdown![0].grams).toBe(220)
  })

  it('rejects a weight estimate that contradicts the stated volume', async () => {
    // 100 ml of an unknown liquid can't weigh 900 g.
    mocks.findFood.mockResolvedValue({ fdcId: 1, description: 'Liqueur', dataType: 'SR Legacy', per100g: profile({ calories: 300 }) })

    const { meta } = await computeNutrition(
      recipe([{ name: 'Licor de hierbas', quantity: '100', unit: 'ml', nameEn: 'herbal liqueur', grams: 900 }]),
    )
    expect(meta!.breakdown![0].grams).toBe(100)
  })

  it('leaves out ingredients with no usable quantity, and says so', async () => {
    mocks.providers.mockReturnValue([])

    const { nutrition, meta } = await computeNutrition(
      recipe([
        { name: 'Azúcar', quantity: '100', unit: 'g', normalized: 'azúcar' },
        { name: 'Canela', normalized: 'canela' },
      ]),
    )

    expect(nutrition!.calories).toBe(387)
    expect(meta!.notes).toEqual(['Sin cantidad convertible a gramos, no incluidos en el cálculo: Canela.'])
  })
})

describe('computeNutrition — resolution tiers', () => {
  it('queries USDA with the English name when the snapshot has no match', async () => {
    mocks.findFood.mockResolvedValue({
      fdcId: 42,
      description: 'Pork, cured, ham, dry-cured',
      dataType: 'SR Legacy',
      per100g: profile({ calories: 250, protein: 30, fat: 14, carbohydrates: 0, water: 52 }),
    })

    const { nutrition, meta } = await computeNutrition(
      recipe([{ name: 'Jamón ibérico', quantity: '100', unit: 'g', normalized: 'jamón ibérico', nameEn: 'iberian ham' }]),
    )

    expect(mocks.findFood).toHaveBeenCalledWith('iberian ham')
    expect(nutrition).toMatchObject({ calories: 250, protein: 30 })
    expect(meta).toMatchObject({ source: 'usda', coverage: 1 })
    expect(meta!.breakdown![0]).toMatchObject({ source: 'usda', match: 'Pork, cured, ham, dry-cured' })
  })

  it('falls back to the dictionary translation when there is no English name', async () => {
    await computeNutrition(recipe([{ name: 'Harina de almendra tostada', quantity: '100', unit: 'g' }]))
    expect(mocks.findFood).toHaveBeenCalledWith('almond flour')
  })

  it('skips USDA entirely when no API key is configured', async () => {
    mocks.usdaConfigured.mockReturnValue(false)

    await computeNutrition(recipe([{ name: 'Yuzu', quantity: '100', unit: 'g', nameEn: 'yuzu' }]))

    expect(mocks.findFood).not.toHaveBeenCalled()
  })

  it('asks the LLM, in one batch, only for what the databases could not resolve', async () => {
    mocks.estimateIngredients.mockResolvedValue(
      new Map([[1, { grams: 30, per100g: profile({ calories: 400, protein: 0, fat: 0, carbohydrates: 100, water: 0 }) }]]),
    )

    const { nutrition, meta } = await computeNutrition(
      recipe([
        { name: 'Azúcar', quantity: '70', unit: 'g', normalized: 'azúcar' },
        { name: 'Isomalt', quantity: '2', unit: 'sobres', nameEn: 'isomalt' },
      ]),
    )

    expect(mocks.estimateIngredients).toHaveBeenCalledTimes(1)
    const [, pending] = mocks.estimateIngredients.mock.calls[0]
    expect(pending).toEqual([{ index: 1, ingredient: expect.objectContaining({ name: 'Isomalt' }) }])

    // 70 g sugar (387) + 30 g isomalt (400) over 100 g
    expect(nutrition!.calories).toBe(Math.round(70 * 3.87 + 30 * 4))
    expect(meta).toMatchObject({ source: 'mixed', coverage: 0.7 })
    expect(meta!.breakdown![1]).toMatchObject({ grams: 30, source: 'llm' })
    expect(meta!.notes).toContain('Sin coincidencia en USDA, estimados por IA: Isomalt.')
  })

  it('marks the result as estimated when nothing came from a database', async () => {
    mocks.estimateIngredients.mockResolvedValue(
      new Map([[0, { per100g: profile({ calories: 350, protein: 5, fat: 1, carbohydrates: 80, water: 10 }) }]]),
    )

    const { meta } = await computeNutrition(recipe([{ name: 'Tapioca', quantity: '100', unit: 'g', nameEn: 'tapioca pearls' }]))

    expect(meta).toMatchObject({ source: 'estimated', coverage: 0 })
  })

  it('does not call the LLM when no provider is configured', async () => {
    mocks.providers.mockReturnValue([])

    const { nutrition, meta } = await computeNutrition(
      recipe([
        { name: 'Azúcar', quantity: '100', unit: 'g', normalized: 'azúcar' },
        { name: 'Isomalt', quantity: '50', unit: 'g' },
      ]),
    )

    expect(mocks.estimateIngredients).not.toHaveBeenCalled()
    // The unknown ingredient is excluded from the totals AND from the weight —
    // counting its weight with no nutrients would dilute everything else.
    expect(nutrition!.calories).toBe(387)
    expect(meta!.coverage).toBeCloseTo(0.67, 2)
    expect(meta!.notes).toContain('Sin datos nutricionales, no incluidos en el cálculo: Isomalt.')
  })

  it('survives a USDA outage by estimating instead, and reports it', async () => {
    mocks.findFood.mockRejectedValue(new USDAError('rate_limit', 'USDA rate limit exceeded'))
    mocks.estimateIngredients.mockResolvedValue(
      new Map([[0, { per100g: profile({ calories: 160, protein: 2, fat: 15, carbohydrates: 9, water: 73 }) }]]),
    )

    const { nutrition, meta } = await computeNutrition(
      recipe([{ name: 'Chirimoya', quantity: '100', unit: 'g', nameEn: 'cherimoya' }]),
    )

    expect(nutrition!.calories).toBe(160)
    expect(meta!.notes!.some((n) => n.includes('límite de peticiones'))).toBe(true)
  })
})

describe('computeNutrition — aggregation', () => {
  it('weights each ingredient by its mass', async () => {
    // 300 g flour (364 kcal) + 100 g sugar (387 kcal) → (1092 + 387) / 400 g
    const { nutrition } = await computeNutrition(
      recipe([
        { name: 'Harina', quantity: '300', unit: 'g', normalized: 'harina' },
        { name: 'Azúcar', quantity: '100', unit: 'g', normalized: 'azúcar' },
      ]),
    )
    expect(nutrition!.calories).toBe(Math.round(((3 * 364 + 387) / 400) * 100))
  })

  it('concentrates nutrients when cooking drives water off', async () => {
    const ingredients: Ingredient[] = [
      { name: 'Harina', quantity: '300', unit: 'g', normalized: 'harina' },
      { name: 'Leche', quantity: '200', unit: 'g', normalized: 'leche' },
    ]
    const raw = await computeNutrition(recipe(ingredients))
    const baked = await computeNutrition(recipe(ingredients, { cookingYield: 0.8 }))

    expect(baked.meta!.totalWeight).toBe(400)
    expect(baked.nutrition!.calories).toBe(Math.round(raw.nutrition!.calories! / 0.8))
    expect(baked.nutrition!.water!).toBeLessThan(raw.nutrition!.water!)
    // Only water leaves: dry matter per 100 g goes up by the same factor.
    expect(baked.nutrition!.dryExtract!).toBeCloseTo(raw.nutrition!.dryExtract! / 0.8, 0)
  })

  it('dilutes nutrients when the dish absorbs unlisted water', async () => {
    const pasta: Ingredient[] = [{ name: 'Pasta', quantity: '200', unit: 'g', normalized: 'pasta' }]
    const { nutrition, meta } = await computeNutrition(recipe(pasta, { cookingYield: 2.2 }))

    expect(meta!.totalWeight).toBe(440)
    expect(nutrition!.calories).toBe(Math.round(371 / 2.2))
    expect(nutrition!.water!).toBeGreaterThan(50)
  })

  it('never lets a dish lose more water than it contains', async () => {
    // Sugar is ~0 % water: an absurd yield can't shrink it.
    const { nutrition, meta } = await computeNutrition(
      recipe([{ name: 'Azúcar', quantity: '100', unit: 'g', normalized: 'azúcar' }], { cookingYield: 0.3 }),
    )

    expect(meta!.totalWeight).toBe(100)
    expect(nutrition!.calories).toBe(387)
    expect(nutrition!.water).toBeCloseTo(0, 0)
  })

  it('clamps an implausible cooking yield', async () => {
    const { meta } = await computeNutrition(
      recipe([{ name: 'Agua', quantity: '100', unit: 'g', normalized: 'agua' }], { cookingYield: 50 }),
    )
    expect(meta!.totalWeight).toBe(300)
  })

  it('omits a nutrient when too much of the dish has no value for it', async () => {
    mocks.estimateIngredients.mockResolvedValue(
      new Map([[1, { per100g: profile({ calories: 300, protein: 10, fat: 10, carbohydrates: 40 }) }]]),
    )

    const { nutrition } = await computeNutrition(
      recipe([
        { name: 'Harina', quantity: '100', unit: 'g', normalized: 'harina' },
        { name: 'Preparado misterioso', quantity: '100', unit: 'g' },
      ]),
    )

    // Half the dish has no water / sodium / fibre figure → reporting a number would understate it.
    expect(nutrition!.calories).toBeDefined()
    expect(nutrition!.water).toBeUndefined()
    expect(nutrition!.dryExtract).toBeUndefined()
    expect(nutrition!.sodium).toBeUndefined()
  })
})

describe('computeNutrition — cross-check and fallback', () => {
  it('flags a large gap with the model’s own whole-dish estimate', async () => {
    const { meta } = await computeNutrition(
      recipe([{ name: 'Azúcar', quantity: '100', unit: 'g', normalized: 'azúcar' }]),
      { dishEstimate: { calories: 150 } },
    )
    expect(meta!.notes!.some((n) => n.includes('387 kcal/100 g') && n.includes('150 kcal/100 g'))).toBe(true)
  })

  it('stays quiet when both figures roughly agree', async () => {
    const { meta } = await computeNutrition(
      recipe([{ name: 'Azúcar', quantity: '100', unit: 'g', normalized: 'azúcar' }]),
      { dishEstimate: { calories: 400 } },
    )
    expect(meta!.notes).toEqual([])
  })

  it('falls back to the whole-dish estimate when no ingredient can be weighed', async () => {
    mocks.providers.mockReturnValue([])

    const { nutrition, meta } = await computeNutrition(
      recipe([{ name: 'Harina' }, { name: 'Azúcar' }]),
      { dishEstimate: { calories: 380, protein: 6 } },
    )

    expect(nutrition).toEqual({ calories: 380, protein: 6 })
    expect(meta).toMatchObject({ source: 'estimated', coverage: 0 })
  })

  it('returns nothing when there is no data and no estimate', async () => {
    mocks.providers.mockReturnValue([])

    expect(await computeNutrition(recipe([{ name: 'Harina' }]))).toEqual({})
    expect(await computeNutrition(recipe([]))).toEqual({})
  })
})
