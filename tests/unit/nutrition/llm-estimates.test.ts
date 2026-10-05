import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ complete: vi.fn() }))

vi.mock('@/lib/llm/provider', () => ({
  getLLMProvider: () => ({ complete: mocks.complete }),
  getLLMProviderByName: () => ({ complete: mocks.complete }),
}))

import { estimateIngredients, reconcileEnergy } from '@/lib/nutrition/llm-estimates'
import { emptyProfile } from '@/lib/nutrition/types'

const recipe = { title: 'Tabla de ibéricos', servings: 4 }
const requests = [
  { index: 0, ingredient: { name: 'jamón serrano', quantity: '100', unit: 'g' } },
  { index: 2, ingredient: { name: 'sal', notes: 'al gusto' } },
]

const reply = (payload: unknown) => ({ text: JSON.stringify(payload), provider: 'anthropic', model: 'test' })

beforeEach(() => {
  mocks.complete.mockReset()
})

describe('reconcileEnergy', () => {
  const profile = (values: Partial<ReturnType<typeof emptyProfile>>) => ({ ...emptyProfile(), alcohol: 0, ...values })

  it('keeps calories that agree with the macros', () => {
    const p = profile({ calories: 241, protein: 31, fat: 13, carbohydrates: 0 })
    expect(reconcileEnergy(p).calories).toBe(241)
  })

  it('replaces calories that contradict the macros (kJ given as kcal)', () => {
    const p = profile({ calories: 1008, protein: 31, fat: 13, carbohydrates: 0 })
    expect(reconcileEnergy(p).calories).toBe(241)
  })

  it('fills in missing calories from the macros', () => {
    expect(reconcileEnergy(profile({ protein: 10, fat: 10, carbohydrates: 10 })).calories).toBe(170)
  })

  it('counts alcohol', () => {
    const rum = profile({ calories: 231, protein: 0, fat: 0, carbohydrates: 0, alcohol: 33.4 })
    expect(reconcileEnergy(rum).calories).toBe(231)
  })

  it('leaves fibre-heavy foods alone', () => {
    // Cocoa powder: 4/4/9 says ~430 kcal, the real figure is ~230.
    const cocoa = profile({ calories: 228, protein: 19.6, fat: 13.7, carbohydrates: 57.9, fiber: 37 })
    expect(reconcileEnergy(cocoa).calories).toBe(228)
  })

  it('does nothing without a full set of macros', () => {
    expect(reconcileEnergy(profile({ calories: 50, protein: 1 })).calories).toBe(50)
  })
})

describe('estimateIngredients', () => {
  it('does not call the model when there is nothing to estimate', async () => {
    expect((await estimateIngredients(recipe, [])).size).toBe(0)
    expect(mocks.complete).not.toHaveBeenCalled()
  })

  it('sends one batched prompt listing each ingredient with its index', async () => {
    mocks.complete.mockResolvedValue(reply({ items: [] }))

    await estimateIngredients(recipe, requests)

    const prompt = mocks.complete.mock.calls[0][0][0].content as string
    expect(prompt).toContain('"Tabla de ibéricos" (4 servings)')
    expect(prompt).toContain('0. 100 g jamón serrano')
    expect(prompt).toContain('2. sal (al gusto)')
  })

  it('maps a well-formed answer to grams and a per-100 g profile', async () => {
    mocks.complete.mockResolvedValue(reply({
      items: [
        { i: 0, grams: 100, calories: 241, protein: 31, fat: 13, saturatedFat: 4.5, carbohydrates: 0, sugar: 0, fiber: 0, water: 50, alcohol: 0, sodium: 2100 },
        { i: 2, grams: 3, calories: 0, protein: 0, fat: 0, saturatedFat: 0, carbohydrates: 0, sugar: 0, fiber: 0, water: 0, alcohol: 0, sodium: 38758 },
      ],
    }))

    const estimates = await estimateIngredients(recipe, requests)

    expect(estimates.get(0)).toMatchObject({ grams: 100, per100g: { calories: 241, protein: 31, sodium: 2100 } })
    expect(estimates.get(2)).toMatchObject({ grams: 3, per100g: { calories: 0, sodium: 38758 } })
  })

  it('accepts fenced JSON, numeric strings and nulls', async () => {
    mocks.complete.mockResolvedValue({
      text: '```json\n{"items":[{"i":"0","grams":"100","calories":"241","protein":31,"fat":13,"carbohydrates":0,"water":null,"sodium":null}]}\n```',
      provider: 'ollama',
      model: 'test',
    })

    const estimate = (await estimateIngredients(recipe, requests)).get(0)!

    expect(estimate.grams).toBe(100)
    expect(estimate.per100g).toMatchObject({ calories: 241, water: null, sodium: null })
  })

  it('drops implausible numbers without discarding the rest of the item', async () => {
    mocks.complete.mockResolvedValue(reply({
      items: [{ i: 0, grams: -5, calories: 241, protein: 31, fat: 13, carbohydrates: 0, sodium: 9_999_999 }],
    }))

    const estimate = (await estimateIngredients(recipe, requests)).get(0)!

    expect(estimate.grams).toBeUndefined()
    expect(estimate.per100g).toMatchObject({ calories: 241, sodium: null })
  })

  it('rejects a profile whose components exceed 100 g per 100 g', async () => {
    mocks.complete.mockResolvedValue(reply({
      items: [{ i: 0, grams: 100, calories: 400, protein: 60, fat: 40, carbohydrates: 30, water: 20 }],
    }))

    const estimate = (await estimateIngredients(recipe, requests)).get(0)!

    expect(estimate.grams).toBe(100)
    expect(estimate.per100g).toBeUndefined()
  })

  it('ignores items for ingredients it was not asked about', async () => {
    mocks.complete.mockResolvedValue(reply({ items: [{ i: 7, grams: 10, calories: 100 }] }))
    expect((await estimateIngredients(recipe, requests)).size).toBe(0)
  })

  it('retries once when the first answer is not usable', async () => {
    mocks.complete
      .mockResolvedValueOnce({ text: 'Claro, aquí tienes la estimación…', provider: 'ollama', model: 'test' })
      .mockResolvedValueOnce(reply({ items: [{ i: 0, grams: 100, calories: 241, protein: 31, fat: 13, carbohydrates: 0 }] }))

    const estimates = await estimateIngredients(recipe, requests)

    expect(mocks.complete).toHaveBeenCalledTimes(2)
    expect(estimates.get(0)?.grams).toBe(100)
  })

  it('never throws: a failing provider just yields no estimates', async () => {
    mocks.complete.mockRejectedValue(new Error('overloaded'))

    const estimates = await estimateIngredients(recipe, requests)

    expect(estimates.size).toBe(0)
    expect(mocks.complete).toHaveBeenCalledTimes(2)
  })
})
