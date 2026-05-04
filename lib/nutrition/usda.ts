const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1'

export interface NutritionData {
  calories: number | null
  protein: number | null
  fat: number | null
  saturatedFat: number | null
  carbohydrates: number | null
  sugar: number | null
  fiber: number | null
  water: number | null
  dryExtract: number | null
  sodium: number | null
}

interface USDFoodNutrient {
  nutrient?: { id: number; name: string; unitName: string }
  nutrientId?: number
  nutrientName?: string
  unitName?: string
  amount?: number
  value?: number
}

interface USDFoodSearchResult {
  fdcId: number
  description: string
  dataType: string
  foodNutrients: USDFoodNutrient[]
}

export class USDAError extends Error {
  constructor(public readonly kind: 'config' | 'http' | 'rate_limit' | 'not_found', message: string) {
    super(message)
    this.name = 'USDAError'
  }
}

const NUTRIENT_IDS: Record<keyof Omit<NutritionData, 'dryExtract'>, number[]> = {
  calories:      [1008, 208],
  protein:       [1003, 203],
  fat:           [1004, 204],
  saturatedFat:  [1258, 606],
  carbohydrates: [1005, 205],
  sugar:         [2000, 269],
  fiber:         [1079, 291],
  water:         [1051, 255],
  sodium:        [1093, 307],
}

interface CacheEntry<T> {
  data: T
  expires: number
}

const CACHE_TTL_MS = 1000 * 60 * 30
const nutritionCache = new Map<string, CacheEntry<NutritionData>>()
const searchCache = new Map<string, CacheEntry<{ fdcId: number; description: string; dataType: string }[]>>()

function getApiKey(): string {
  const key = process.env.USDA_API_KEY
  if (!key) throw new USDAError('config', 'USDA_API_KEY not configured')
  return key
}

function getNutrientId(n: USDFoodNutrient): number | undefined {
  return n.nutrient?.id ?? n.nutrientId
}

function getNutrientAmount(n: USDFoodNutrient): number | undefined {
  return n.amount ?? n.value
}

function mapNutrient(nutrients: USDFoodNutrient[], ids: number[]): number | null {
  for (const id of ids) {
    const found = nutrients.find((n) => getNutrientId(n) === id)
    const amount = found ? getNutrientAmount(found) : undefined
    if (amount !== undefined && Number.isFinite(amount)) return Number(amount)
  }
  return null
}

async function usdaFetch<T>(url: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  } catch (err) {
    throw new USDAError('http', `USDA network error: ${err instanceof Error ? err.message : 'unknown'}`)
  }
  if (response.status === 429) throw new USDAError('rate_limit', 'USDA rate limit exceeded')
  if (response.status === 404) throw new USDAError('not_found', 'USDA resource not found')
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new USDAError('http', `USDA HTTP ${response.status}: ${body.slice(0, 200)}`)
  }
  return (await response.json()) as T
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) return entry.data
  cache.delete(key)
  return undefined
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
}

function buildNutritionData(nutrients: USDFoodNutrient[]): NutritionData {
  const water = mapNutrient(nutrients, NUTRIENT_IDS.water)
  const dryExtract = water !== null ? Math.max(0, 100 - water) : null
  return {
    calories:      mapNutrient(nutrients, NUTRIENT_IDS.calories),
    protein:       mapNutrient(nutrients, NUTRIENT_IDS.protein),
    fat:           mapNutrient(nutrients, NUTRIENT_IDS.fat),
    saturatedFat:  mapNutrient(nutrients, NUTRIENT_IDS.saturatedFat),
    carbohydrates: mapNutrient(nutrients, NUTRIENT_IDS.carbohydrates),
    sugar:         mapNutrient(nutrients, NUTRIENT_IDS.sugar),
    fiber:         mapNutrient(nutrients, NUTRIENT_IDS.fiber),
    water,
    dryExtract,
    sodium:        mapNutrient(nutrients, NUTRIENT_IDS.sodium),
  }
}

export async function searchFood(
  query: string,
  pageSize: number = 5
): Promise<{ fdcId: number; description: string; dataType: string }[]> {
  const cacheKey = `${query}:${pageSize}`
  const cached = getCached(searchCache, cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  const params = new URLSearchParams({
    query,
    dataType: 'Foundation,SR Legacy',
    pageSize: String(pageSize),
    api_key: apiKey,
  })

  const data = await usdaFetch<{ foods: USDFoodSearchResult[] }>(`${USDA_API_BASE}/foods/search?${params}`)
  const results = (data.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    description: f.description,
    dataType: f.dataType,
  }))

  setCached(searchCache, cacheKey, results)
  return results
}

export async function getFoodNutrients(fdcId: number): Promise<NutritionData | null> {
  const cacheKey = String(fdcId)
  const cached = getCached(nutritionCache, cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  const params = new URLSearchParams({ api_key: apiKey })

  try {
    const data = await usdaFetch<{ foodNutrients: USDFoodNutrient[] }>(
      `${USDA_API_BASE}/food/${fdcId}?${params}`
    )
    const nutrients = data.foodNutrients ?? []
    const result = buildNutritionData(nutrients)
    if (result.calories !== null) setCached(nutritionCache, cacheKey, result)
    return result
  } catch (err) {
    if (err instanceof USDAError && err.kind === 'not_found') return null
    throw err
  }
}

export async function searchAndGetNutrients(
  query: string
): Promise<{ fdcId: number; description: string; nutrition: NutritionData } | null> {
  const results = await searchFood(query, 5)
  if (results.length === 0) return null

  const sorted = [...results].sort((a, b) => {
    const score = (d: string) => (d === 'Foundation' ? 2 : d === 'SR Legacy' ? 1 : 0)
    return score(b.dataType) - score(a.dataType)
  })

  for (const candidate of sorted) {
    try {
      const nutrition = await getFoodNutrients(candidate.fdcId)
      if (nutrition && nutrition.calories !== null) {
        return { fdcId: candidate.fdcId, description: candidate.description, nutrition }
      }
    } catch {}
  }
  return null
}

export function scaleNutrition(nutrition: NutritionData, grams: number): NutritionData {
  const scale = grams / 100
  const round1 = (v: number) => Math.round(v * 10) / 10
  return {
    calories:      nutrition.calories      !== null ? Math.round(nutrition.calories * scale) : null,
    protein:       nutrition.protein       !== null ? round1(nutrition.protein * scale) : null,
    fat:           nutrition.fat           !== null ? round1(nutrition.fat * scale) : null,
    saturatedFat:  nutrition.saturatedFat  !== null ? round1(nutrition.saturatedFat * scale) : null,
    carbohydrates: nutrition.carbohydrates !== null ? round1(nutrition.carbohydrates * scale) : null,
    sugar:         nutrition.sugar         !== null ? round1(nutrition.sugar * scale) : null,
    fiber:         nutrition.fiber         !== null ? round1(nutrition.fiber * scale) : null,
    water:         nutrition.water         !== null ? round1(nutrition.water * scale) : null,
    dryExtract:    nutrition.dryExtract    !== null ? round1(nutrition.dryExtract * scale) : null,
    sodium:        nutrition.sodium        !== null ? round1(nutrition.sodium * scale) : null,
  }
}