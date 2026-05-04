import { readFileSync } from 'fs'
import { join } from 'path'
import { getLLMProvider, getLLMProviderByName, getAvailableProviders } from './llm/provider'
import type { LLMProvider } from './llm/types'

/** Truncation limit — well above any real recipe, prevents cost-amplification attacks */
const MAX_INPUT_CHARS = 50_000
import { RecipeSchema, NutritionSchema, type Recipe, type Ingredient, type Nutrition } from './schema'
import { RecipeProcessingError } from './errors'
import { parseText } from './parsers/text'
import { searchAndGetNutrients, scaleNutrition, USDAError, type NutritionData } from './nutrition/usda'
import { gramsFromQuantity, parseQuantity } from './nutrition/parser'
import { translateIngredient } from './nutrition/translate'

function loadSystemPrompt(): string {
  return readFileSync(join(process.cwd(), 'prompts', 'parse-recipe.md'), 'utf-8')
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  // Some LLMs (esp. small Ollama models) prepend prose; grab the first {...} block
  const braceStart = text.indexOf('{')
  const braceEnd = text.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1).trim()
  }
  return text.trim()
}

// Small Ollama models sometimes wrap the recipe under a key like {"recipe":{...}}
// or {"receta":{...}}. Unwrap one level if the root lacks a string title + array ingredients.
function unwrapRecipe(parsed: unknown): unknown {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed
  const obj = parsed as Record<string, unknown>
  const looksLikeRecipe = typeof obj.title === 'string' && Array.isArray(obj.ingredients)
  if (looksLikeRecipe) return obj
  // Try each value that is a plain object — return the first that looks like a recipe
  for (const val of Object.values(obj)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const inner = val as Record<string, unknown>
      if (typeof inner.title === 'string' || Array.isArray(inner.ingredients)) return inner
    }
  }
  return obj
}

// Normalise structural quirks from small LLMs before Zod validation:
//   - Alternative field names (recipeName → title, preparationSteps → steps, etc.)
//   - ingredients as dict {"name": "qty unit"} → [{name, quantity, unit}]
//   - steps as dict {"1": "instruction"} or array of strings → [{order, instruction}]
function normalizeLLMOutput(obj: Record<string, unknown>): Record<string, unknown> {
  const out = { ...obj }

  // ── Field aliases ──────────────────────────────────────────────────────────
  const titleAliases = ['recipeName', 'recipe_name', 'nombre', 'name']
  for (const alias of titleAliases) {
    if (out.title === undefined && out[alias] !== undefined) {
      out.title = out[alias]; delete out[alias]
    }
  }
  const stepsAliases = ['preparationSteps', 'preparation_steps', 'instructions', 'pasos', 'elaboracion', 'elaboración']
  for (const alias of stepsAliases) {
    if (out.steps === undefined && out[alias] !== undefined) {
      out.steps = out[alias]; delete out[alias]
    }
  }
  const ingAliases = ['ingredientes', 'ingredientList', 'ingredient_list']
  for (const alias of ingAliases) {
    if (out.ingredients === undefined && out[alias] !== undefined) {
      out.ingredients = out[alias]; delete out[alias]
    }
  }

  // ── ingredients: dict {"name": qty_or_str} → [{name, quantity, unit}] ──────
  if (out.ingredients !== null && typeof out.ingredients === 'object' && !Array.isArray(out.ingredients)) {
    out.ingredients = Object.entries(out.ingredients as Record<string, unknown>).map(([name, val]) => {
      // numeric value: positive = amount (treat as grams if >5, else unit count), ≤0 = "al gusto"
      if (typeof val === 'number') {
        if (val <= 0) return { name }
        return { name, quantity: String(val), unit: val > 5 ? 'g' : undefined }
      }
      const raw = typeof val === 'string' ? val.trim() : ''
      if (!raw || raw === '-') return { name }
      const match = raw.match(/^([\d./]+)\s*(.*)$/)
      if (match) return { name, quantity: match[1], unit: match[2].trim() || undefined }
      return { name, quantity: raw }
    })
  }

  // ── steps: dict {"1":"text"} → array; or array where items may be strings or
  //    objects with non-standard field names (stepNumber/description, etc.) ────
  if (out.steps !== null && typeof out.steps === 'object' && !Array.isArray(out.steps)) {
    out.steps = Object.entries(out.steps as Record<string, unknown>)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v], idx) => ({
        order: isNaN(Number(k)) ? idx + 1 : Number(k),
        instruction: typeof v === 'string' ? v : String(v),
      }))
  } else if (Array.isArray(out.steps)) {
    out.steps = (out.steps as unknown[]).map((s, idx) => {
      if (typeof s === 'string') return { order: idx + 1, instruction: s }
      if (typeof s === 'object' && s !== null) {
        const step = s as Record<string, unknown>
        const order = step.order ?? step.stepNumber ?? step.step_number ??
          step.stepNo ?? step.number ?? step.num ?? idx + 1
        const instruction = step.instruction ?? step.description ??
          step.text ?? step.content ?? step.step ?? step.instruccion ?? ''
        return {
          order,
          instruction,
          ...(step.duration != null && { duration: step.duration }),
        }
      }
      return { order: idx + 1, instruction: String(s) }
    })
  }

  return out
}

// LLMs return null for absent optional fields; Zod .optional() only accepts undefined.
// Also converts NaN to null since some LLMs return NaN instead of null.
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && Number.isNaN(v) !== true)
        .map(([k, v]) => [k, Number.isNaN(v) ? null : stripNulls(v)]),
    )
  }
  return value
}

// Fix LLM error of embedding unit in quantity field (e.g. quantity:"1500 gr", unit:"gr").
// After splitting, deduplicates unit vs quantity so display never shows "1500 gr gr".
function normalizeIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.map((ing) => {
    const qty = ing.quantity ?? ''

    // quantity already has embedded unit AND no separate unit → split
    if (qty && !ing.unit) {
      const parsed = parseQuantity(qty)
      if (parsed.unit) {
        return { ...ing, quantity: parsed.quantity, unit: parsed.unit }
      }
    }

    // quantity has embedded unit AND a separate unit exists → strip unit from quantity
    if (qty && ing.unit) {
      const parsed = parseQuantity(qty)
      if (parsed.unit) {
        return { ...ing, quantity: parsed.quantity }
      }
    }

    return ing
  })
}

function isAIAvailable(): boolean {
  return getAvailableProviders().length > 0
}

function isUSDAConfigured(): boolean {
  return !!process.env.USDA_API_KEY
}

const NUTRITION_KEYS: (keyof NutritionData)[] = [
  'calories', 'protein', 'fat', 'saturatedFat', 'carbohydrates',
  'sugar', 'fiber', 'water', 'dryExtract', 'sodium',
]

function emptyTotals(): Record<keyof NutritionData, number> {
  return {
    calories: 0, protein: 0, fat: 0, saturatedFat: 0, carbohydrates: 0,
    sugar: 0, fiber: 0, water: 0, dryExtract: 0, sodium: 0,
  }
}

function aggregateAndPer100g(
  totals: Record<keyof NutritionData, number>,
  totalGrams: number
): Record<keyof NutritionData, number> {
  // Normalise to per-100g. If total weight is unknown fall back to identity (totals already represent 100g).
  const scale = totalGrams > 0 ? 100 / totalGrams : 1
  const round1 = (v: number) => Math.round(v * 10) / 10

  return {
    calories: Math.round(totals.calories * scale),
    protein: round1(totals.protein * scale),
    fat: round1(totals.fat * scale),
    saturatedFat: round1(totals.saturatedFat * scale),
    carbohydrates: round1(totals.carbohydrates * scale),
    sugar: round1(totals.sugar * scale),
    fiber: round1(totals.fiber * scale),
    water: round1(totals.water * scale),
    dryExtract: round1(totals.dryExtract * scale),
    sodium: round1(totals.sodium * scale),
  }
}

interface USDAFillResult {
  nutritionByIndex: Map<number, NutritionData>
  matched: string[]
  missing: string[]
  errors: string[]
  totalGrams: number
}

async function fetchUSDAPerIngredient(recipe: Recipe): Promise<USDAFillResult> {
  const result: USDAFillResult = {
    nutritionByIndex: new Map(),
    matched: [],
    missing: [],
    errors: [],
    totalGrams: 0,
  }

  if (!isUSDAConfigured()) {
    result.missing = recipe.ingredients.map((i) => i.name)
    return result
  }

  const fetchPromises = recipe.ingredients.map(async (ing, i) => {
    const grams = gramsFromQuantity(ing.quantity ?? null, ing.unit ?? null, ing.name)
    const query = translateIngredient(ing.name)

    try {
      const found = await searchAndGetNutrients(query)
      if (found && found.nutrition.calories !== null) {
        const scaled = grams !== null ? scaleNutrition(found.nutrition, grams) : found.nutrition
        return { index: i, data: scaled, name: ing.name, matched: true, grams }
      }
      return { index: i, name: ing.name, matched: false, grams }
    } catch (err) {
      return { index: i, name: ing.name, matched: false, grams, error: err instanceof USDAError ? err : undefined }
    }
  })

  const outcomes = await Promise.all(fetchPromises)

  for (const outcome of outcomes) {
    if (outcome.grams !== null && outcome.grams !== undefined) {
      result.totalGrams += outcome.grams
    }
    if (outcome.matched && outcome.data) {
      result.nutritionByIndex.set(outcome.index, outcome.data)
      result.matched.push(outcome.name)
    } else {
      result.missing.push(outcome.name)
      if (outcome.error && !result.errors.find((e) => e.includes(outcome.error!.kind))) {
        result.errors.push(`USDA ${outcome.error.kind}: ${outcome.error.message}`)
      }
    }
  }

  return result
}

const NUTRITION_JSON_TEMPLATE =
  '{"calories":number,"protein":number,"fat":number,"saturatedFat":number,' +
  '"carbohydrates":number,"sugar":number,"fiber":number,"water":number,' +
  '"dryExtract":number,"sodium":number}'

function buildNutritionPrompt(recipe: Recipe, missingNames?: string[]): string {
  const ingredientList = recipe.ingredients
    .map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(' '))
    .join(', ')

  const focus = missingNames && missingNames.length > 0
    ? `Focus on estimating contribution from: ${missingNames.join(', ')}.\n`
    : ''

  return `Recipe: "${recipe.title}" (${recipe.servings ?? 4} servings).
Ingredients: ${ingredientList}
${focus}
Return ONLY a JSON object with estimated nutritional values per 100 g of finished dish. No prose.
${NUTRITION_JSON_TEMPLATE}

Units: calories=kcal, sodium=mg, others=g per 100 g of finished dish.
dryExtract = grams of solids per 100 g (dry matter: 100 minus water content). For solid dishes ~80-95; for soups/drinks much lower.
RULES:
- Output ONLY raw JSON. No markdown fences, no commentary.
- Use null (NOT NaN, NOT "NaN", NOT undefined) for values you cannot estimate.
- All other values must be numbers (no strings, no units in values).`
}

async function estimateNutritionWithLLM(
  recipe: Recipe,
  missingNames?: string[],
  providerName?: LLMProvider,
): Promise<{ nutrition: Nutrition | null; provider: string }> {
  const llm = providerName ? getLLMProviderByName(providerName) : getLLMProvider()
  const prompt = buildNutritionPrompt(recipe, missingNames)

  // Two-attempt retry — small models (qwen2.5:3b) sometimes return prose first.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await llm.complete(
        [{ role: 'user', content: prompt }],
        { temperature: 0, jsonMode: true }
      )
      const jsonText = extractJSON(result.text)
      const parsed = JSON.parse(jsonText)
      const validated = NutritionSchema.safeParse(stripNulls(parsed))
      if (validated.success && Object.keys(validated.data).length > 0) {
        return { nutrition: validated.data, provider: result.provider }
      }
    } catch {
      // try once more
    }
  }

  return { nutrition: null, provider: providerName ?? process.env.LLM_PROVIDER ?? 'anthropic' }
}

function mergeNutrition(primary: Nutrition | undefined, fallback: Nutrition | null): Nutrition {
  const merged: Nutrition = { ...(primary ?? {}) }
  if (!fallback) return merged
  for (const key of NUTRITION_KEYS) {
    if (merged[key] === undefined && fallback[key] !== undefined) {
      merged[key] = fallback[key]
    }
  }
  return merged
}

function nutritionFromTotals(
  result: USDAFillResult,
  ingredients: Ingredient[],
): { nutrition: Nutrition; allFound: boolean } {
  const totals = emptyTotals()
  let coverage = 0

  for (let i = 0; i < ingredients.length; i++) {
    const data = result.nutritionByIndex.get(i)
    if (!data) continue
    coverage++
    for (const key of NUTRITION_KEYS) {
      if (data[key] !== null) {
        totals[key] += data[key]!
      }
    }
  }

  const aggregated = aggregateAndPer100g(totals, result.totalGrams)
  // Strip zeros that came from no data (everything 0 → field missing)
  const nutrition: Nutrition = {}
  if (coverage > 0) {
    for (const key of NUTRITION_KEYS) {
      if (aggregated[key] > 0) {
        nutrition[key] = aggregated[key]
      }
    }
  }

  return { nutrition, allFound: coverage === ingredients.length }
}

function listMissingFields(n: Nutrition): (keyof Nutrition)[] {
  const required: (keyof Nutrition)[] = [
    'calories', 'protein', 'fat', 'carbohydrates', 'water', 'dryExtract',
  ]
  return required.filter((k) => n[k] === undefined)
}

const FIELD_LABELS: Record<keyof Nutrition, string> = {
  calories: 'calorías',
  protein: 'proteínas',
  fat: 'grasas',
  saturatedFat: 'grasas saturadas',
  carbohydrates: 'hidratos',
  sugar: 'azúcares',
  fiber: 'fibra',
  water: 'agua',
  dryExtract: 'extracto seco',
  sodium: 'sodio',
}

async function fillNutrition(recipe: Recipe, providerName?: LLMProvider): Promise<Recipe> {
  const servings = recipe.servings ?? 4
  const usdaResult = await fetchUSDAPerIngredient(recipe)
  const { nutrition: usdaNutrition, allFound } = nutritionFromTotals(
    usdaResult, recipe.ingredients
  )

  const warnings = [...recipe.warnings]
  let nutrition: Nutrition = usdaNutrition
  let provider = 'usda'

  if (!allFound || Object.keys(nutrition).length === 0) {
    // Fill remaining via LLM
    const aiAvailable = isAIAvailable()
    if (aiAvailable) {
      const llmResult = await estimateNutritionWithLLM(recipe, usdaResult.missing, providerName)
      nutrition = mergeNutrition(nutrition, llmResult.nutrition)
      provider = Object.keys(usdaNutrition).length > 0 ? `mixed (USDA + ${llmResult.provider})` : llmResult.provider
    }
  }

  // Build warnings
  if (usdaResult.matched.length > 0 && usdaResult.missing.length === 0) {
    warnings.push('Valores nutricionales obtenidos de USDA FoodData Central')
  } else if (usdaResult.matched.length > 0 && usdaResult.missing.length > 0) {
    warnings.push(
      `Valores nutricionales: USDA + estimación IA. Sin datos USDA para: ${usdaResult.missing.join(', ')}`
    )
  } else if (Object.keys(nutrition).length > 0) {
    warnings.push('Valores nutricionales estimados por IA (aproximados)')
  }

  if (usdaResult.errors.length > 0) {
    warnings.push(`Aviso USDA: ${usdaResult.errors.join('; ')}`)
  }

  // Field-level gaps
  const missingFields = Object.keys(nutrition).length > 0 ? listMissingFields(nutrition) : []
  if (missingFields.length > 0) {
    warnings.push(
      `Faltan datos nutricionales: ${missingFields.map((k) => FIELD_LABELS[k]).join(', ')}`
    )
  } else if (Object.keys(nutrition).length === 0) {
    warnings.push('No se pudieron calcular valores nutricionales')
  }

  void provider

  return {
    ...recipe,
    nutrition: Object.keys(nutrition).length > 0 ? nutrition : undefined,
    warnings,
  }
}

export async function processRecipe(rawInput: string, providerName?: LLMProvider): Promise<Recipe> {
  if (!rawInput.trim()) {
    throw new RecipeProcessingError('EMPTY_CONTENT', 'No content provided to process')
  }

  // Truncate to prevent cost-amplification; strip C0/C1 control chars (except \t \n \r)
  // to block prompt injection attempts that rely on hidden/invisible characters.
  const input = rawInput
    .slice(0, MAX_INPUT_CHARS)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  if (!isAIAvailable()) {
    return parseText(input)
  }

  const llm = providerName ? getLLMProviderByName(providerName) : getLLMProvider()
  const systemPrompt = loadSystemPrompt()

  let result: { text: string; provider: string }
  try {
    result = await llm.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ], { temperature: 0, jsonMode: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LLM call failed'
    throw new RecipeProcessingError('AI_EXTRACTION_FAILED', msg)
  }

  const jsonText = extractJSON(result.text)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new RecipeProcessingError(
      'PARSING_FAILED',
      `[${result.provider}] Response was not valid JSON`,
    )
  }

  const unwrapped = unwrapRecipe(parsed)
  const normalized = typeof unwrapped === 'object' && unwrapped !== null && !Array.isArray(unwrapped)
    ? normalizeLLMOutput(unwrapped as Record<string, unknown>)
    : unwrapped
  const validated = RecipeSchema.safeParse(stripNulls(normalized))

  if (!validated.success) {
    const issues = validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    const rawSnippet = jsonText.length > 800 ? jsonText.slice(0, 800) + '…' : jsonText
    throw new RecipeProcessingError(
      'AI_EXTRACTION_FAILED',
      `[${result.provider}] Schema validation failed: ${issues}\n\nRaw LLM output:\n${rawSnippet}`,
    )
  }

  const recipe: Recipe = {
    ...validated.data,
    ingredients: normalizeIngredients(validated.data.ingredients),
  }

  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    throw new RecipeProcessingError(
      'AI_EXTRACTION_FAILED',
      `[${result.provider}] Extracted recipe is missing ${recipe.ingredients.length === 0 ? 'ingredients' : 'steps'}`,
    )
  }

  return fillNutrition(recipe, providerName)
}
