import { displayUnit, parseQuantity } from './nutrition/parser'
import type { Ingredient } from './schema'

/**
 * Helpers that turn raw LLM text into something Zod can validate.
 * Small local models (Ollama) are creative with structure, so every step here
 * exists because a real response once needed it.
 */

/** Pulls the JSON payload out of a response that may be fenced or wrapped in prose. */
export function extractJSON(text: string): string {
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

/**
 * Parses LLM output as JSON without throwing. Returns `undefined` when the text
 * is not valid JSON. The result is still untrusted — always `safeParse` it.
 */
export function parseLLMJson(text: string): unknown {
  try {
    return JSON.parse(extractJSON(text))
  } catch {
    return undefined
  }
}

// Field names small models use instead of the ones the prompt asks for.
const TITLE_ALIASES = ['recipeName', 'recipe_name', 'nombre', 'name']
const STEPS_ALIASES = ['preparationSteps', 'preparation_steps', 'instructions', 'pasos', 'elaboracion', 'elaboración']
const INGREDIENTS_ALIASES = ['ingredientes', 'ingredientList', 'ingredient_list']

function looksLikeRecipe(obj: Record<string, unknown>): boolean {
  const has = (keys: string[]) => keys.some((key) => obj[key] !== undefined)
  return has(['title', ...TITLE_ALIASES]) || has(['ingredients', ...INGREDIENTS_ALIASES])
}

// Small Ollama models sometimes wrap the recipe under a key like {"recipe":{...}}
// or {"receta":{...}}. Unwrap one level if the root doesn't look like a recipe itself.
export function unwrapRecipe(parsed: unknown): unknown {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed
  const obj = parsed as Record<string, unknown>
  if (looksLikeRecipe(obj)) return obj
  // Try each value that is a plain object — return the first that looks like a recipe
  for (const val of Object.values(obj)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const inner = val as Record<string, unknown>
      if (looksLikeRecipe(inner)) return inner
    }
  }
  return obj
}

function renameFirstAlias(out: Record<string, unknown>, target: string, aliases: string[]): void {
  for (const alias of aliases) {
    if (out[target] === undefined && out[alias] !== undefined) {
      out[target] = out[alias]
      delete out[alias]
    }
  }
}

// Normalise structural quirks from small LLMs before Zod validation:
//   - Alternative field names (recipeName → title, preparationSteps → steps, etc.)
//   - ingredients as dict {"name": "qty unit"} → [{name, quantity, unit}]
//   - steps as dict {"1": "instruction"} or array of strings → [{order, instruction}]
export function normalizeLLMOutput(obj: Record<string, unknown>): Record<string, unknown> {
  const out = { ...obj }

  // nutritionMeta is computed by the nutrition engine, never by the model.
  delete out.nutritionMeta

  renameFirstAlias(out, 'title', TITLE_ALIASES)
  renameFirstAlias(out, 'steps', STEPS_ALIASES)
  renameFirstAlias(out, 'ingredients', INGREDIENTS_ALIASES)

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
// NaN gets the same treatment — some models emit it instead of null.
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && !Number.isNaN(v))
        .map(([k, v]) => [k, stripNulls(v)]),
    )
  }
  return value
}

// Fix LLM error of embedding unit in quantity field (e.g. quantity:"1500 gr", unit:"gr").
// After splitting, deduplicates unit vs quantity so display never shows "1500 gr gr".
export function normalizeIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.map((ing) => {
    if (!ing.quantity) return ing

    const parsed = parseQuantity(ing.quantity)
    if (!parsed.unit) return ing

    // A separate unit wins; otherwise adopt the one that was glued to the quantity.
    return { ...ing, quantity: parsed.quantity, unit: ing.unit ?? displayUnit(parsed) ?? undefined }
  })
}
