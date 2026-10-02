import { emptyProfile, type NutrientKey, type NutrientProfile } from './types'

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1'
const REQUEST_TIMEOUT_MS = 6_000
const CACHE_TTL_MS = 1000 * 60 * 30
const CACHE_MAX_ENTRIES = 500

export class USDAError extends Error {
  constructor(
    public readonly kind: 'config' | 'http' | 'rate_limit' | 'timeout',
    message: string,
  ) {
    super(message)
    this.name = 'USDAError'
  }
}

export interface USDAFood {
  fdcId: number
  description: string
  dataType: string
  per100g: NutrientProfile
}

interface USDASearchNutrient {
  nutrientId?: number
  value?: number
}

interface USDASearchFood {
  fdcId: number
  description: string
  dataType: string
  foodNutrients?: USDASearchNutrient[]
}

// FoodData Central nutrient ids, in order of preference. Foundation foods often
// report energy only as an Atwater-derived value (2047/2048) and sugars/fibre
// under newer ids, so each nutrient lists its alternates.
const NUTRIENT_IDS: Record<NutrientKey, number[]> = {
  calories: [1008, 2047, 2048],
  protein: [1003],
  fat: [1004, 1085],
  saturatedFat: [1258],
  carbohydrates: [1005, 1050],
  sugar: [2000, 1063],
  fiber: [1079, 2033],
  water: [1051],
  sodium: [1093],
  alcohol: [1018],
}

export function isUSDAConfigured(): boolean {
  return !!process.env.USDA_API_KEY
}

/** Energy from macronutrients using the general Atwater factors (4/4/9/7 kcal per g). */
export function atwaterCalories(p: Pick<NutrientProfile, 'protein' | 'carbohydrates' | 'fat' | 'alcohol'>): number | null {
  if (p.protein === null || p.carbohydrates === null || p.fat === null) return null
  return 4 * p.protein + 4 * p.carbohydrates + 9 * p.fat + 7 * (p.alcohol ?? 0)
}

function toProfile(nutrients: USDASearchNutrient[]): NutrientProfile {
  const byId = new Map<number, number>()
  for (const n of nutrients) {
    if (n.nutrientId !== undefined && typeof n.value === 'number' && Number.isFinite(n.value)) {
      byId.set(n.nutrientId, n.value)
    }
  }

  const profile = emptyProfile()
  for (const key of Object.keys(NUTRIENT_IDS) as NutrientKey[]) {
    const id = NUTRIENT_IDS[key].find((candidate) => byId.has(candidate))
    if (id !== undefined) profile[key] = byId.get(id)!
  }

  // Alcohol is only reported when present.
  profile.alcohol ??= 0
  // Some Foundation entries list macros but no energy at all.
  if (profile.calories === null) {
    const derived = atwaterCalories(profile)
    if (derived !== null) profile.calories = Math.round(derived)
  }
  return profile
}

// ── Candidate ranking ────────────────────────────────────────────────────────

const STOPWORDS = new Set(['and', 'or', 'with', 'of', 'the', 'in', 'for', 'a', 'an', 'to', 'de'])

// Qualifiers that say nothing about composition. A description carrying them is
// not a worse match for a query that omits them — and a query carrying them
// ("large egg", "unsalted butter") does not need the description to repeat them.
const NEUTRAL = new Set([
  'raw', 'fresh', 'whole', 'plain', 'regular', 'unprepared', 'uncooked', 'all',
  'commercial', 'variety', 'year', 'round', 'average', 'include', 'food', 'usda', 'distribution',
  'program', 'without', 'salt', 'salted', 'unsalted', 'added', 'unenriched', 'enriched',
  'bleached', 'unbleached', 'mature', 'seed', 'meat', 'only', 'skinless', 'boneless',
  'separable', 'lean', 'fat', 'milkfat', 'type', 'purpose', 'all-purpose', 'fluid', 'granulated',
  'table', 'salad', 'cooking', 'ripe', 'skin', 'flesh', 'vitamin', 'd', 'broiler', 'fryer',
  'extra', 'virgin', 'organic', 'large', 'medium', 'small', 'chopped', 'sliced', 'diced', 'peeled',
])

/** Numbers and percentages ("3.25%", "70-85%") describe a variant, not a different food. */
const isNumeric = (token: string) => /^\d/.test(token)

// Processing that DOES change composition. A description carrying one of these
// is penalised unless the query asked for it ("dried oregano", "canned tuna").
const PROCESSED = new Set([
  'cooked', 'boiled', 'fried', 'roasted', 'baked', 'grilled', 'braised', 'stewed', 'steamed',
  'microwaved', 'toasted', 'canned', 'frozen', 'dehydrated', 'dried', 'powder', 'powdered',
  'flake', 'mix', 'babyfood', 'restaurant', 'fast', 'imitation', 'substitute', 'sweetened',
  'flavored', 'low', 'reduced', 'nonfat', 'light', 'lite', 'diet', 'fortified', 'instant',
  'prepared', 'breaded', 'smoked', 'pickled', 'juice', 'oil', 'sauce', 'soup', 'bread',
  'candy', 'snack', 'cereal', 'beverage', 'dressing', 'spread', 'drained', 'sprouted',
])

function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2)
  if (word.length > 4 && /(ch|sh|ss|x)es$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9%\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singular)
}

/**
 * Scores how well a USDA food matches an ingredient query. Returns null when the
 * food is not an acceptable match at all.
 *
 * USDA's own relevance ranking is tuned for search, not for "which entry is this
 * ingredient": a query for "egg" returns "Eggs, Grade A, Large, egg white" and
 * "Bagels, egg" ahead of the whole raw egg. Taking the first hit — what this
 * module used to do — produced confidently wrong numbers.
 */
export function scoreCandidate(query: string, food: USDAFood): number | null {
  // No usable energy value → useless for our purposes.
  if (food.per100g.calories === null) return null

  const q = tokenize(query)
  if (q.length === 0) return null
  const qSet = new Set(q)

  const dSet = new Set(tokenize(food.description))

  // "Chicken, canned, meat only, with broth" is chicken, not broth — and
  // "Chicken, canned, no broth" even less so. Whatever follows "with", "without"
  // or "no" is an accompaniment (or its absence) and can't satisfy the query.
  const mainSet = new Set(tokenize(food.description.split(/\b(?:with|without|no)\b/i)[0]))

  // Every meaningful query word must be there. Partial matches are how
  // "cocoa butter" becomes butter and "vanilla bean" becomes cannellini beans —
  // no match at all is better, because the LLM tier then estimates the real food.
  const core = q.filter((t) => !NEUTRAL.has(t))
  const required = core.length > 0 ? core : q
  if (!required.every((t) => mainSet.has(t))) return null

  // USDA descriptions go general → specific: "Onions, raw", "Bagels, egg".
  // The first segment names the food itself.
  const head = tokenize(food.description.split(',')[0])
  const headMatches = head.length > 0 && head.every((t) => qSet.has(t))

  let score = 60
  if (headMatches) score += 25

  const queryWantsProcessed = q.some((t) => PROCESSED.has(t))
  let extras = 0
  for (const token of dSet) {
    if (qSet.has(token)) continue
    if (PROCESSED.has(token)) {
      if (!queryWantsProcessed) score -= 15
    } else if (token === 'dry') {
      // Right for pasta or rice, wrong for milk: a mild penalty lets "Pasta, dry"
      // beat "Pasta, cooked" while fluid milk still beats powdered.
      score -= 6
    } else if (!NEUTRAL.has(token) && !isNumeric(token)) {
      extras++
    }
  }
  score -= Math.min(extras, 8) * 3

  // Recipes list ingredients as bought, i.e. raw.
  if (!queryWantsProcessed && (dSet.has('raw') || dSet.has('fresh') || dSet.has('unprepared'))) score += 8

  // Branded / restaurant items: "DENNY'S, onion rings". Parentheticals are
  // skipped so "(… USDA's Food Distribution Program)" doesn't count as a brand.
  if (/\b[A-Z]{3,}\b/.test(food.description.replace(/\([^)]*\)/g, ''))) score -= 20

  // Prefer entries with the full macro picture; SR Legacy is the most complete dataset.
  const { protein, fat, carbohydrates, water } = food.per100g
  if (protein !== null && fat !== null && carbohydrates !== null && water !== null) score += 6
  if (food.dataType === 'SR Legacy') score += 3
  else if (food.dataType === 'Foundation') score += 2

  return score
}

/** Picks the best-matching food for a query, or null when nothing is good enough. */
export function pickBestMatch(query: string, foods: USDAFood[]): USDAFood | null {
  let best: { food: USDAFood; score: number } | null = null
  for (const food of foods) {
    const score = scoreCandidate(query, food)
    if (score !== null && (best === null || score > best.score)) best = { food, score }
  }
  return best?.food ?? null
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: USDAFood | null
  expires: number
}

// Per-instance cache. On serverless this only lives as long as the function
// instance, which is still enough to dedupe repeated ingredients across recipes.
const matchCache = new Map<string, CacheEntry>()

function cacheGet(key: string): USDAFood | null | undefined {
  const entry = matchCache.get(key)
  if (!entry) return undefined
  if (entry.expires <= Date.now()) {
    matchCache.delete(key)
    return undefined
  }
  return entry.data
}

function cacheSet(key: string, data: USDAFood | null): void {
  if (matchCache.size >= CACHE_MAX_ENTRIES) {
    // Map iterates in insertion order → drop the oldest entry.
    matchCache.delete(matchCache.keys().next().value!)
  }
  matchCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
}

/** Test hook. */
export function clearUSDACache(): void {
  matchCache.clear()
}

async function searchFoods(query: string, dataType: string[]): Promise<USDAFood[]> {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) throw new USDAError('config', 'USDA_API_KEY not configured')

  let response: Response
  try {
    // POST with a JSON body: the GET form intermittently answers 400 for
    // "Survey (FNDDS)", whose parentheses don't survive some of USDA's proxies.
    response = await fetch(`${USDA_API_BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, dataType, pageSize: 25 }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new USDAError('timeout', 'USDA request timed out')
    }
    throw new USDAError('http', `USDA network error: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  if (response.status === 429) throw new USDAError('rate_limit', 'USDA rate limit exceeded')
  if (!response.ok) throw new USDAError('http', `USDA HTTP ${response.status}`)

  const data = (await response.json()) as { foods?: USDASearchFood[] }
  return (data.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    description: f.description,
    dataType: f.dataType,
    per100g: toProfile(f.foodNutrients ?? []),
  }))
}

/**
 * Finds the USDA food that best matches an English ingredient name.
 *
 * Searches the lab-analysed datasets first (Foundation + SR Legacy) and only
 * falls back to the survey dataset (FNDDS) — broader, but built from recipes
 * and mostly cooked dishes — when those have nothing acceptable.
 *
 * One request per ingredient: search results already carry the nutrient values,
 * so there is no need for a follow-up call per candidate.
 */
export async function findFood(query: string): Promise<USDAFood | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null

  const cached = cacheGet(key)
  if (cached !== undefined) return cached

  let match = pickBestMatch(key, await searchFoods(key, ['Foundation', 'SR Legacy']))
  if (!match) match = pickBestMatch(key, await searchFoods(key, ['Survey (FNDDS)']))

  cacheSet(key, match)
  return match
}
