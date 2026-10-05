import { readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  atwaterCalories,
  clearUSDACache,
  findFood,
  pickBestMatch,
  scoreCandidate,
  USDAError,
  type USDAFood,
} from '@/lib/nutrition/usda'
import { emptyProfile } from '@/lib/nutrition/types'

// Real /foods/search responses (Foundation + SR Legacy, top 25 per query),
// trimmed to the fields the client reads. Regenerating them is a one-off script.
type RawFood = { fdcId: number; description: string; dataType: string; foodNutrients: { nutrientId: number; value: number }[] }
const FIXTURES: Record<string, RawFood[]> = JSON.parse(
  readFileSync(join(process.cwd(), 'tests', 'fixtures', 'usda-search.json'), 'utf-8'),
)

function food(description: string, overrides: Partial<USDAFood['per100g']> = {}, dataType = 'SR Legacy'): USDAFood {
  return {
    fdcId: 1,
    description,
    dataType,
    per100g: { ...emptyProfile(), calories: 100, protein: 5, fat: 5, carbohydrates: 10, water: 78, alcohol: 0, ...overrides },
  }
}

function mockSearch(responses: Record<string, RawFood[]>) {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const { query, dataType } = JSON.parse(init.body as string) as { query: string; dataType: string[] }
    const foods = dataType.includes('SR Legacy') ? (responses[query] ?? []) : []
    return new Response(JSON.stringify({ foods }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  process.env.USDA_API_KEY = 'test-key'
  clearUSDACache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.USDA_API_KEY
})

describe('atwaterCalories', () => {
  it('applies the 4/4/9/7 factors', () => {
    expect(atwaterCalories({ protein: 10, carbohydrates: 20, fat: 5, alcohol: 0 })).toBe(165)
    expect(atwaterCalories({ protein: 0, carbohydrates: 0, fat: 0, alcohol: 10 })).toBe(70)
  })

  it('needs all three macros', () => {
    expect(atwaterCalories({ protein: 10, carbohydrates: null, fat: 5, alcohol: 0 })).toBeNull()
  })
})

describe('scoreCandidate', () => {
  it('rejects foods without an energy value', () => {
    expect(scoreCandidate('olive oil', food('Oil, olive, extra virgin', { calories: null }))).toBeNull()
  })

  it('requires every meaningful query word', () => {
    expect(scoreCandidate('cocoa butter', food('Butter, without salt'))).toBeNull()
    expect(scoreCandidate('vanilla bean', food('Beans, cannellini, dry'))).toBeNull()
    expect(scoreCandidate('serrano ham', food('Ham, minced'))).toBeNull()
  })

  it('does not require descriptors that say nothing about composition', () => {
    expect(scoreCandidate('large raw egg', food('Egg, whole, raw, fresh'))).not.toBeNull()
    expect(scoreCandidate('unsalted butter', food('Butter, without salt'))).not.toBeNull()
  })

  it('ignores whatever follows "with", "without" or "no"', () => {
    expect(scoreCandidate('chicken broth', food('Chicken, canned, meat only, with broth'))).toBeNull()
    expect(scoreCandidate('chicken broth', food('Chicken, canned, no broth'))).toBeNull()
  })

  it('matches plurals in either direction', () => {
    expect(scoreCandidate('onion', food('Onions, raw'))).not.toBeNull()
    expect(scoreCandidate('tomatoes', food('Tomato, red, ripe, raw'))).not.toBeNull()
  })

  it('prefers the plain raw food over processed variants', () => {
    const raw = scoreCandidate('onion', food('Onions, raw'))!
    expect(raw).toBeGreaterThan(scoreCandidate('onion', food('Onions, dehydrated flakes'))!)
    expect(raw).toBeGreaterThan(scoreCandidate('onion', food('Onions, frozen, chopped, cooked, boiled'))!)
    expect(raw).toBeGreaterThan(scoreCandidate('onion', food('Onions, red, raw'))!)
  })

  it('keeps processed variants when the query asks for them', () => {
    const canned = scoreCandidate('canned chickpeas', food('Chickpeas, mature seeds, canned, drained solids'))!
    const raw = scoreCandidate('canned chickpeas', food('Chickpeas, mature seeds, raw'))
    expect(raw).toBeNull()
    expect(canned).toBeGreaterThan(0)
  })

  it('penalises branded and restaurant items', () => {
    const generic = scoreCandidate('onion rings', food('Onion rings, breaded, par fried, frozen, unprepared'))!
    const branded = scoreCandidate('onion rings', food("DENNY'S, onion rings"))!
    expect(generic).toBeGreaterThan(branded)
  })

  it('does not mistake a USDA programme note for a brand', () => {
    const plain = scoreCandidate('cheddar cheese', food('Cheese, cheddar'))!
    const noted = scoreCandidate('cheddar cheese', food("Cheese, cheddar (Includes foods for USDA's Food Distribution Program)"))!
    expect(noted).toBe(plain)
  })

  it('prefers fluid milk over powdered', () => {
    const fluid = scoreCandidate('whole milk', food('Milk, whole, 3.25% milkfat, with added vitamin D'))!
    const dry = scoreCandidate('whole milk', food('Milk, dry, whole, with added vitamin D'))!
    expect(fluid).toBeGreaterThan(dry)
  })
})

describe('pickBestMatch — against real USDA search results', () => {
  const candidates = (query: string): USDAFood[] =>
    FIXTURES[query].map((f) => ({
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType,
      per100g: {
        ...emptyProfile(),
        calories: f.foodNutrients.find((n) => n.nutrientId === 1008)?.value ?? null,
        protein: f.foodNutrients.find((n) => n.nutrientId === 1003)?.value ?? null,
        fat: f.foodNutrients.find((n) => n.nutrientId === 1004)?.value ?? null,
        carbohydrates: f.foodNutrients.find((n) => n.nutrientId === 1005)?.value ?? null,
        water: f.foodNutrients.find((n) => n.nutrientId === 1051)?.value ?? null,
      },
    }))

  // USDA's own first hit for "egg" is "Eggs, Grade A, Large, egg white".
  it('resolves "egg" to the whole raw egg, not egg white or egg bagels', () => {
    expect(pickBestMatch('egg', candidates('egg'))?.description).toBe('Egg, whole, raw, fresh')
  })

  it('resolves "onion" to raw onions', () => {
    expect(pickBestMatch('onion', candidates('onion'))?.description).toBe('Onions, raw')
  })

  it('resolves "olive oil" to an entry that has energy data', () => {
    const match = pickBestMatch('olive oil', candidates('olive oil'))
    expect(match?.description).toBe('Oil, olive, salad or cooking')
    expect(match?.per100g.calories).toBe(884)
  })

  it('resolves "cocoa butter" to cocoa butter, not dairy butter', () => {
    expect(pickBestMatch('cocoa butter', candidates('cocoa butter'))?.description).toBe('Oil, cocoa butter')
  })

  it('finds nothing for foods USDA does not list, rather than a lookalike', () => {
    expect(pickBestMatch('vanilla bean', candidates('vanilla bean'))).toBeNull()
    expect(pickBestMatch('serrano ham', candidates('serrano ham'))).toBeNull()
  })

  it('keeps canned chickpeas canned', () => {
    expect(pickBestMatch('canned chickpeas', candidates('canned chickpeas'))?.description).toContain('canned')
  })
})

describe('findFood', () => {
  it('maps nutrient ids to a per-100 g profile', async () => {
    mockSearch(FIXTURES)

    const egg = await findFood('egg')

    expect(egg).toMatchObject({ fdcId: 171287, description: 'Egg, whole, raw, fresh', dataType: 'SR Legacy' })
    expect(egg!.per100g).toMatchObject({ calories: 143, protein: 12.6, fat: 9.51, water: 76.2, alcohol: 0 })
  })

  it('derives energy from macros when a food only reports those', async () => {
    mockSearch({
      plantain: [{
        fdcId: 9, description: 'Plantains, raw', dataType: 'Foundation',
        foodNutrients: [
          { nutrientId: 1003, value: 1.3 }, { nutrientId: 1004, value: 0.4 }, { nutrientId: 1005, value: 32 },
        ],
      }],
    })

    expect((await findFood('plantain'))!.per100g.calories).toBe(Math.round(4 * 1.3 + 4 * 32 + 9 * 0.4))
  })

  it('falls back to the survey dataset only when the analytical ones have no match', async () => {
    const fetchMock = mockSearch(FIXTURES)

    await findFood('egg')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await findFood('dragon fruit')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string).dataType).toEqual(['Survey (FNDDS)'])
  })

  it('caches matches and misses', async () => {
    const fetchMock = mockSearch(FIXTURES)

    await findFood('Egg')
    await findFood('egg ')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await findFood('unobtainium')
    await findFood('unobtainium')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns null for an empty query without calling the API', async () => {
    const fetchMock = mockSearch(FIXTURES)
    expect(await findFood('  ')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a missing API key as a config error', async () => {
    delete process.env.USDA_API_KEY
    await expect(findFood('egg')).rejects.toMatchObject({ name: 'USDAError', kind: 'config' })
  })

  it('classifies rate limiting, HTTP failures and timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })))
    await expect(findFood('a')).rejects.toMatchObject({ kind: 'rate_limit' })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(findFood('b')).rejects.toMatchObject({ kind: 'http' })

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    }))
    await expect(findFood('c')).rejects.toBeInstanceOf(USDAError)
    await expect(findFood('c')).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('never puts the API key in the request body', async () => {
    const fetchMock = mockSearch(FIXTURES)
    await findFood('egg')
    expect(fetchMock.mock.calls[0][1].body).not.toContain('test-key')
  })
})
