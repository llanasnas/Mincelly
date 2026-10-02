/**
 * Nutrients tracked per ingredient. All values are per 100 g of edible portion:
 * calories in kcal, sodium in mg, everything else in g.
 *
 * `alcohol` never reaches the UI — it only exists so the Atwater energy check
 * stays meaningful for wine, beer and spirits (7 kcal/g).
 */
export const NUTRIENT_KEYS = [
  'calories',
  'protein',
  'fat',
  'saturatedFat',
  'carbohydrates',
  'sugar',
  'fiber',
  'water',
  'sodium',
  'alcohol',
] as const

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

/** `null` means "unknown", which is different from a measured zero. */
export type NutrientProfile = Record<NutrientKey, number | null>

/**
 * Where an ingredient's nutrient profile came from, most to least trustworthy:
 * - `reference`: bundled USDA SR Legacy snapshot (lib/nutrition/reference-data.ts)
 * - `usda`: live USDA FoodData Central search
 * - `llm`: per-ingredient estimate from the language model
 */
export type ProfileSource = 'reference' | 'usda' | 'llm'

export interface ReferenceFood {
  fdcId: number
  description: string
  /** Lowercase, unaccented, singular names (Spanish + English) that resolve to this food. */
  aliases: string[]
  per100g: NutrientProfile
}

export interface ResolvedProfile {
  per100g: NutrientProfile
  source: ProfileSource
  /** Human-readable name of the matched database entry, when there is one. */
  match?: string
  fdcId?: number
}

export function emptyProfile(): NutrientProfile {
  return {
    calories: null,
    protein: null,
    fat: null,
    saturatedFat: null,
    carbohydrates: null,
    sugar: null,
    fiber: null,
    water: null,
    sodium: null,
    alcohol: null,
  }
}
