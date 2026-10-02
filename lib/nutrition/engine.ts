import { getAvailableProviders } from '../llm/provider'
import type { LLMProvider } from '../llm/types'
import type { Ingredient, Nutrition, NutritionMeta, Recipe } from '../schema'
import { estimateIngredients, type EstimateRequest } from './llm-estimates'
import { measure } from './parser'
import { findReferenceFood } from './reference-foods'
import { translateIngredient } from './translate'
import { NUTRIENT_KEYS, type NutrientKey, type ResolvedProfile } from './types'
import { findFood, isUSDAConfigured, USDAError } from './usda'

/**
 * Nutrition engine.
 *
 * Computes per-100 g values for a recipe bottom-up, ingredient by ingredient,
 * instead of asking a model to guess the whole dish:
 *
 *   1. Weight    — every quantity becomes grams: exact unit conversion when the
 *                  recipe weighs or measures, an estimate when it counts ("2 huevos").
 *   2. Profile   — each ingredient is resolved to per-100 g nutrients, trying the
 *                  most trustworthy source first: bundled USDA snapshot → live USDA
 *                  search → LLM estimate for that single ingredient.
 *   3. Aggregate — nutrients are summed by weight, then corrected for cooking
 *                  yield (water lost in the oven, or absorbed by pasta and rice).
 *   4. Report    — how much of the dish is backed by measured data travels with
 *                  the result, so the UI can say how far to trust it.
 */

/** Both fields are absent when nothing could be computed or estimated. */
export interface NutritionOutcome {
  nutrition?: Nutrition
  /** Provenance of the values, including user-facing notes (Spanish) about any gaps. */
  meta?: NutritionMeta
}

export interface NutritionOptions {
  provider?: LLMProvider
  /**
   * The model's own whole-dish estimate, when the parsing step produced one.
   * Used as a sanity check against the computed values, and as a last resort
   * when the recipe has no usable quantities at all.
   */
  dishEstimate?: Nutrition
}

/** A nutrient is reported only if this share of the dish's weight has a value for it. */
const MIN_NUTRIENT_COVERAGE = 0.85
/** Computed vs. model-estimated calories further apart than this get flagged. */
const CROSS_CHECK_TOLERANCE = 0.4
const YIELD_RANGE = { min: 0.3, max: 3 }

interface Line {
  ingredient: Ingredient
  grams: number | null
  profile: ResolvedProfile | null
}

const round1 = (v: number) => Math.round(v * 10) / 10

function lookupName(ing: Ingredient): string {
  return `${ing.name} ${ing.normalized ?? ''}`.trim()
}

/**
 * Weight of an ingredient. A real unit conversion (grams, millilitres of a
 * liquid we know the density of) always beats the model's estimate; for counted
 * items ("1 cebolla") the model has the context to do better than a lookup table.
 */
function resolveGrams(ing: Ingredient): number | null {
  const measured = measure(ing.quantity, ing.unit, lookupName(ing))

  if (measured && (measured.kind === 'mass' || (measured.kind === 'volume' && measured.confident))) {
    return measured.grams
  }

  if (ing.grams) {
    // A volume we converted with a generic density still bounds what is plausible.
    if (measured?.kind === 'volume') {
      const ratio = ing.grams / measured.grams
      if (ratio < 0.3 || ratio > 1.7) return measured.grams
    }
    return ing.grams
  }

  return measured?.grams ?? null
}

async function resolveProfile(ing: Ingredient): Promise<ResolvedProfile | null> {
  const reference = findReferenceFood(ing.normalized, ing.name, ing.nameEn)
  if (reference) {
    return {
      per100g: reference.per100g,
      source: 'reference',
      match: reference.description,
      fdcId: reference.fdcId,
    }
  }

  if (!isUSDAConfigured()) return null

  const query = ing.nameEn?.trim() || translateIngredient(ing.normalized ?? ing.name)
  const food = await findFood(query)
  return food
    ? { per100g: food.per100g, source: 'usda', match: food.description, fdcId: food.fdcId }
    : null
}

function listNames(lines: Line[]): string {
  const names = lines.map((l) => l.ingredient.name)
  return names.length > 5 ? `${names.slice(0, 5).join(', ')}…` : names.join(', ')
}

function hasValues(n: Nutrition | undefined): n is Nutrition {
  return !!n && Object.keys(n).length > 0
}

/** Nothing could be computed bottom-up — fall back to the model's whole-dish estimate, if any. */
function fallbackOutcome(dishEstimate: Nutrition | undefined): NutritionOutcome {
  if (!hasValues(dishEstimate)) return {}
  return {
    nutrition: dishEstimate,
    meta: {
      source: 'estimated',
      coverage: 0,
      notes: ['Estimación directa de la IA: la receta no indica cantidades suficientes para calcular los valores ingrediente a ingrediente.'],
    },
  }
}

export async function computeNutrition(
  recipe: Pick<Recipe, 'title' | 'servings' | 'ingredients' | 'cookingYield'>,
  options: NutritionOptions = {},
): Promise<NutritionOutcome> {
  if (recipe.ingredients.length === 0) return fallbackOutcome(options.dishEstimate)

  // ── 1 + 2. Weight and profile per ingredient ───────────────────────────────
  // Held in an object so the assignment inside the async callbacks below is visible to TS.
  const usda: { error?: USDAError } = {}
  const lines: Line[] = await Promise.all(
    recipe.ingredients.map(async (ingredient): Promise<Line> => {
      let profile: ResolvedProfile | null = null
      try {
        profile = await resolveProfile(ingredient)
      } catch (err) {
        // A database hiccup must not fail the recipe — the LLM tier picks it up.
        if (err instanceof USDAError) usda.error = err
      }
      return { ingredient, grams: resolveGrams(ingredient), profile }
    }),
  )

  // One batched LLM call for whatever is still unknown.
  const pending: EstimateRequest[] = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.grams === null || line.profile === null)
    .map(({ line, index }) => ({ index, ingredient: line.ingredient }))

  if (pending.length > 0 && getAvailableProviders().length > 0) {
    const estimates = await estimateIngredients(recipe, pending, options.provider)
    for (const [index, estimate] of estimates) {
      const line = lines[index]
      if (line.grams === null && estimate.grams) line.grams = estimate.grams
      if (line.profile === null && estimate.per100g) {
        line.profile = { per100g: estimate.per100g, source: 'llm' }
      }
    }
  }

  // ── 3. Aggregate ───────────────────────────────────────────────────────────
  const usable = lines.filter(
    (l): l is Line & { grams: number; profile: ResolvedProfile } => l.grams !== null && l.profile !== null,
  )
  const rawWeight = usable.reduce((sum, l) => sum + l.grams, 0)
  if (usable.length === 0 || rawWeight <= 0) return fallbackOutcome(options.dishEstimate)

  const totals = {} as Record<NutrientKey, number>
  const knownWeight = {} as Record<NutrientKey, number>
  for (const key of NUTRIENT_KEYS) {
    totals[key] = 0
    knownWeight[key] = 0
  }
  for (const line of usable) {
    for (const key of NUTRIENT_KEYS) {
      const value = line.profile.per100g[key]
      if (value === null) continue
      totals[key] += (value * line.grams) / 100
      knownWeight[key] += line.grams
    }
  }
  const isKnown = (key: NutrientKey) => knownWeight[key] / rawWeight >= MIN_NUTRIENT_COVERAGE

  // Cooking changes the dish's weight but only through water: nutrients stay put.
  const yieldFactor = Math.min(YIELD_RANGE.max, Math.max(YIELD_RANGE.min, recipe.cookingYield ?? 1))
  let finishedWeight = rawWeight * yieldFactor
  let water: number | undefined
  if (isKnown('water')) {
    // A dish can't lose more water than it contains.
    finishedWeight = Math.max(finishedWeight, rawWeight - totals.water)
    water = Math.max(0, totals.water + (finishedWeight - rawWeight))
  }

  const per100 = (total: number) => (total / finishedWeight) * 100
  const nutrition: Nutrition = {}
  if (isKnown('calories')) nutrition.calories = Math.round(per100(totals.calories))
  if (isKnown('protein')) nutrition.protein = round1(per100(totals.protein))
  if (isKnown('fat')) nutrition.fat = round1(per100(totals.fat))
  if (isKnown('saturatedFat')) nutrition.saturatedFat = round1(per100(totals.saturatedFat))
  if (isKnown('carbohydrates')) nutrition.carbohydrates = round1(per100(totals.carbohydrates))
  if (isKnown('sugar')) nutrition.sugar = round1(per100(totals.sugar))
  if (isKnown('fiber')) nutrition.fiber = round1(per100(totals.fiber))
  if (isKnown('sodium')) nutrition.sodium = Math.round(per100(totals.sodium))
  if (water !== undefined) {
    nutrition.water = round1(per100(water))
    nutrition.dryExtract = round1(100 - per100(water))
  }

  // ── 4. Report ──────────────────────────────────────────────────────────────
  const weighed = lines.filter((l) => l.grams !== null)
  const weighedTotal = weighed.reduce((sum, l) => sum + l.grams!, 0)
  const measuredWeight = usable
    .filter((l) => l.profile.source !== 'llm')
    .reduce((sum, l) => sum + l.grams, 0)
  const estimatedLines = usable.filter((l) => l.profile.source === 'llm')

  const notes: string[] = []
  const meta: NutritionMeta = {
    source: estimatedLines.length === 0 ? 'usda' : measuredWeight === 0 ? 'estimated' : 'mixed',
    coverage: Math.round((measuredWeight / weighedTotal) * 100) / 100,
    totalWeight: Math.round(finishedWeight),
    breakdown: lines.map((line) => ({
      name: line.ingredient.name,
      ...(line.grams !== null && { grams: round1(line.grams) }),
      ...(line.grams !== null && line.profile?.per100g.calories != null && {
        calories: Math.round((line.profile.per100g.calories * line.grams) / 100),
      }),
      ...(line.profile && { source: line.profile.source }),
      ...(line.profile?.match && { match: line.profile.match }),
    })),
    notes,
  }

  const unweighed = lines.filter((l) => l.grams === null)
  if (unweighed.length > 0) {
    notes.push(`Sin cantidad convertible a gramos, no incluidos en el cálculo: ${listNames(unweighed)}.`)
  }
  const unprofiled = weighed.filter((l) => l.profile === null)
  if (unprofiled.length > 0) {
    notes.push(`Sin datos nutricionales, no incluidos en el cálculo: ${listNames(unprofiled)}.`)
  }
  if (estimatedLines.length > 0) {
    notes.push(`Sin coincidencia en USDA, estimados por IA: ${listNames(estimatedLines)}.`)
  }
  if (usda.error) {
    notes.push(
      usda.error.kind === 'rate_limit'
        ? 'USDA FoodData Central ha alcanzado su límite de peticiones; parte de los valores son estimados.'
        : 'No se pudo consultar USDA FoodData Central; parte de los valores son estimados.',
    )
  }

  const estimated = options.dishEstimate?.calories
  if (nutrition.calories !== undefined && estimated !== undefined && nutrition.calories > 0) {
    const deviation = Math.abs(nutrition.calories - estimated) / nutrition.calories
    if (deviation > CROSS_CHECK_TOLERANCE) {
      notes.push(
        `Las calorías calculadas (${nutrition.calories} kcal/100 g) difieren de la estimación directa del modelo (${Math.round(estimated)} kcal/100 g). Revisa las cantidades.`,
      )
    }
  }

  return { nutrition, meta }
}
