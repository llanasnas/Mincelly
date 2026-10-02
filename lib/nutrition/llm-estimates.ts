import { z } from 'zod'
import { getLLMProvider, getLLMProviderByName } from '../llm/provider'
import type { LLMProvider } from '../llm/types'
import { parseLLMJson, stripNulls } from '../llm-output'
import type { Ingredient } from '../schema'
import { atwaterCalories } from './usda'
import { emptyProfile, type NutrientProfile } from './types'

/** What we still don't know about an ingredient after the deterministic steps. */
export interface EstimateRequest {
  index: number
  ingredient: Ingredient
}

export interface IngredientEstimate {
  grams?: number
  per100g?: NutrientProfile
}

// Each field is validated on its own: one implausible number must not discard
// the rest of the item, and one bad item must not discard the batch.
const bounded = (max: number) =>
  z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return undefined
    const n = Number(val)
    return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined
  }, z.number().optional())

const EstimateItemSchema = z.object({
  i: z.coerce.number().int().nonnegative(),
  grams: bounded(20_000),
  calories: bounded(900),
  protein: bounded(100),
  fat: bounded(100),
  saturatedFat: bounded(100),
  carbohydrates: bounded(100),
  sugar: bounded(100),
  fiber: bounded(100),
  water: bounded(100),
  sodium: bounded(40_000),
  alcohol: bounded(100),
})

const EstimateResponseSchema = z.object({ items: z.array(z.unknown()) })

function describe(ing: Ingredient): string {
  const text = [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')
  return ing.notes ? `${text} (${ing.notes})` : text
}

function buildPrompt(title: string, servings: number | undefined, requests: EstimateRequest[]): string {
  const list = requests.map((r) => `${r.index}. ${describe(r.ingredient)}`).join('\n')

  return `You are a food-composition expert. The recipe "${title}"${servings ? ` (${servings} servings)` : ''} uses these ingredients:

${list}

For EACH ingredient return:
- "i": the number shown before it.
- "grams": weight in grams of the stated quantity, edible portion only. If no quantity is given ("al gusto", "to taste"), the amount typically used in this recipe.
- Nutrition per 100 g of the ingredient as purchased (raw / uncooked unless its name says otherwise): "calories" (kcal), "protein", "fat", "saturatedFat", "carbohydrates", "sugar", "fiber", "water", "alcohol" (all in g) and "sodium" (mg).

Return ONLY a JSON object, no prose and no markdown fences:
{"items":[{"i":0,"grams":0,"calories":0,"protein":0,"fat":0,"saturatedFat":0,"carbohydrates":0,"sugar":0,"fiber":0,"water":0,"alcohol":0,"sodium":0}]}

Rules: values are plain numbers without units. Use null (never NaN) for a value you cannot estimate.`
}

/** Above this much fibre (g/100 g) the general Atwater factors stop being a fair yardstick. */
const HIGH_FIBER = 15
const ENERGY_TOLERANCE = 0.3

/**
 * LLM estimates fail in a characteristic way: plausible macros with an energy
 * value that doesn't add up — kJ instead of kcal, or a per-serving figure. When
 * calories drift more than 30 % from what the macros imply, trust the macros:
 * they are three independent guesses instead of one.
 *
 * Fibre-heavy foods (cocoa, spices, bran) are left alone: most of their
 * "carbohydrate" yields no energy, so their real calories sit far below 4/4/9.
 */
export function reconcileEnergy(profile: NutrientProfile): NutrientProfile {
  const derived = atwaterCalories(profile)
  if (derived === null) return profile
  if (profile.calories === null) return { ...profile, calories: Math.round(derived) }
  if ((profile.fiber ?? 0) >= HIGH_FIBER) return profile

  const larger = Math.max(profile.calories, derived)
  if (larger > 20 && Math.abs(profile.calories - derived) / larger > ENERGY_TOLERANCE) {
    return { ...profile, calories: Math.round(derived) }
  }
  return profile
}

function toProfile(item: z.infer<typeof EstimateItemSchema>): NutrientProfile | undefined {
  const profile: NutrientProfile = {
    ...emptyProfile(),
    calories: item.calories ?? null,
    protein: item.protein ?? null,
    fat: item.fat ?? null,
    saturatedFat: item.saturatedFat ?? null,
    carbohydrates: item.carbohydrates ?? null,
    sugar: item.sugar ?? null,
    fiber: item.fiber ?? null,
    water: item.water ?? null,
    sodium: item.sodium ?? null,
    alcohol: item.alcohol ?? 0,
  }

  // 100 g of food cannot contain more than ~100 g of stuff.
  const mass = (profile.protein ?? 0) + (profile.fat ?? 0) + (profile.carbohydrates ?? 0) +
    (profile.water ?? 0) + (profile.alcohol ?? 0)
  if (mass > 110) return undefined

  const reconciled = reconcileEnergy(profile)
  return reconciled.calories === null ? undefined : reconciled
}

/**
 * Asks the LLM for the weight and per-100 g nutrition of the ingredients the
 * databases couldn't resolve — one batched call for the whole recipe.
 *
 * Never throws: a failed estimate just means those ingredients stay unresolved.
 */
export async function estimateIngredients(
  recipe: { title: string; servings?: number },
  requests: EstimateRequest[],
  providerName?: LLMProvider,
): Promise<Map<number, IngredientEstimate>> {
  const estimates = new Map<number, IngredientEstimate>()
  if (requests.length === 0) return estimates

  const wanted = new Set(requests.map((r) => r.index))
  const prompt = buildPrompt(recipe.title, recipe.servings, requests)

  // Two attempts — small models sometimes answer with prose the first time.
  for (let attempt = 0; attempt < 2 && estimates.size === 0; attempt++) {
    let text: string
    try {
      const llm = providerName ? getLLMProviderByName(providerName) : getLLMProvider()
      const result = await llm.complete([{ role: 'user', content: prompt }], {
        temperature: 0,
        jsonMode: true,
        maxTokens: 4096,
      })
      text = result.text
    } catch {
      continue
    }

    const response = EstimateResponseSchema.safeParse(stripNulls(parseLLMJson(text)))
    if (!response.success) continue

    for (const raw of response.data.items) {
      const item = EstimateItemSchema.safeParse(raw)
      if (!item.success || !wanted.has(item.data.i)) continue
      estimates.set(item.data.i, {
        grams: item.data.grams && item.data.grams > 0 ? item.data.grams : undefined,
        per100g: toProfile(item.data),
      })
    }
  }

  return estimates
}
