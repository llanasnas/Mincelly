import { z } from 'zod'

// RecipeType is used externally; re-export from categories to keep schema self-contained
export type { RecipeType } from './categories'

// For optional numeric hints coming from an LLM: a bad value (0, negative, "n/a")
// is dropped instead of failing validation of the whole recipe.
const optionalPositive = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? n : undefined
}, z.number().positive().optional())

export const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.string().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  normalized: z.string().optional(),
  /** Common English name of the food — the query used against nutrition databases. */
  nameEn: z.string().optional(),
  /** Estimated weight in grams of the stated quantity (edible portion). */
  grams: optionalPositive,
})

export const StepSchema = z.object({
  order: z.coerce.number().int().positive(),
  instruction: z.string(),
  duration: z.string().optional(),
})

const coerceNum = z.coerce.number().nonnegative()

const difficultyCoerce = z.preprocess((val) => {
  if (typeof val !== 'string') return val
  const v = val.toLowerCase().trim()
  if (['easy', 'fácil', 'facil', 'simple', 'baja', 'bajo', 'low'].includes(v)) return 'easy'
  if (['medium', 'medio', 'media', 'moderate', 'moderado', 'moderada', 'normal', 'intermediate'].includes(v)) return 'medium'
  if (['hard', 'difícil', 'dificil', 'difficult', 'alta', 'alto', 'high', 'advanced', 'avanzado'].includes(v)) return 'hard'
  return val
}, z.enum(['easy', 'medium', 'hard']).optional())

export const NutritionSchema = z.object({
  calories: coerceNum.optional(),
  protein: coerceNum.optional(),
  fat: coerceNum.optional(),
  saturatedFat: coerceNum.optional(),
  carbohydrates: coerceNum.optional(),
  sugar: coerceNum.optional(),
  fiber: coerceNum.optional(),
  water: coerceNum.optional(),
  dryExtract: coerceNum.optional(),
  sodium: coerceNum.optional(),
})

/** How the nutrition values were obtained — shown to the user so they know how far to trust them. */
export const NutritionMetaSchema = z.object({
  /**
   * `usda`: every weighed ingredient matched USDA data.
   * `mixed`: some ingredients fell back to an LLM estimate.
   * `estimated`: no database data — values are an LLM estimate.
   */
  source: z.enum(['usda', 'mixed', 'estimated']),
  /** Share (0–1) of the recipe's weight whose nutrients come from USDA data. */
  coverage: z.number().min(0).max(1),
  /** Weight in grams of the finished dish, after cooking gains/losses. */
  totalWeight: z.number().positive().optional(),
  /** Per-ingredient contribution, in recipe order. */
  breakdown: z
    .array(
      z.object({
        name: z.string(),
        grams: z.number().nonnegative().optional(),
        calories: z.number().nonnegative().optional(),
        source: z.enum(['reference', 'usda', 'llm']).optional(),
        /** Name of the matched database entry. */
        match: z.string().optional(),
      }),
    )
    .optional(),
  /** User-facing remarks about gaps in the calculation. */
  notes: z.array(z.string()).optional(),
})

const servingsCoerce = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined
  const n = typeof val === 'string' ? parseInt(val, 10) : Number(val)
  return isNaN(n) || n <= 0 ? undefined : n
}, z.number().int().positive().optional())

// Coerce object-shaped arrays that small LLMs sometimes return:
//  - {"0":{...},"1":{...}} (numeric-keyed) → spread values in order
//  - {"name":"...", ...}  (single item)    → wrap in [val]
function objToArray(val: unknown): unknown {
  if (Array.isArray(val)) return val
  if (val !== null && typeof val === 'object') {
    const keys = Object.keys(val as Record<string, unknown>)
    const allNumeric = keys.length > 0 && keys.every((k) => /^\d+$/.test(k))
    if (allNumeric) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (val as Record<string, unknown>)[k])
    }
    return [val] // single object — wrap in array
  }
  return val
}

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  servings: servingsCoerce,
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  cuisine: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['cocina', 'pasteleria', 'bebidas']).optional(),
  categories: z.array(z.string()).default([]),
  difficulty: difficultyCoerce,
  ingredients: z.preprocess(objToArray, z.array(IngredientSchema)),
  steps: z.preprocess(objToArray, z.array(StepSchema)),
  tags: z.array(z.string()).default([]),
  sourceUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
  warnings: z.array(z.string()).default([]),
  /** Per 100 g of finished dish. */
  nutrition: NutritionSchema.optional(),
  nutritionMeta: NutritionMetaSchema.optional(),
  /**
   * Finished weight ÷ summed raw ingredient weight. Below 1 when water cooks off
   * (baking, reductions), above 1 when the dish absorbs water that is not listed
   * as an ingredient (pasta, rice).
   */
  cookingYield: optionalPositive,
  estimatedCost: z.coerce.number().nonnegative().optional(),
})

export const RecipeSaveSchema = RecipeSchema.extend({
  title: z.string().min(1, 'Title is required'),
  ingredients: z.array(IngredientSchema).min(1, 'At least one ingredient required'),
  steps: z.array(StepSchema).min(1, 'At least one step required'),
})

export type Ingredient = z.infer<typeof IngredientSchema>
export type Step = z.infer<typeof StepSchema>
export type Nutrition = z.infer<typeof NutritionSchema>
export type NutritionMeta = z.infer<typeof NutritionMetaSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type RecipeSave = z.infer<typeof RecipeSaveSchema>
