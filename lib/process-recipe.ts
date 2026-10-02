import { readFileSync } from 'fs'
import { join } from 'path'
import { getLLMProvider, getLLMProviderByName, getAvailableProviders } from './llm/provider'
import type { LLMProvider } from './llm/types'
import { RecipeSchema, type Recipe } from './schema'
import { RecipeProcessingError } from './errors'
import { parseText } from './parsers/text'
import { computeNutrition } from './nutrition/engine'
import {
  extractJSON,
  normalizeIngredients,
  normalizeLLMOutput,
  parseLLMJson,
  stripNulls,
  unwrapRecipe,
} from './llm-output'

/** Truncation limit — well above any real recipe, prevents cost-amplification attacks */
const MAX_INPUT_CHARS = 50_000
/** Room for long recipes: ~40 ingredients with nutrition hints fit comfortably. */
const MAX_OUTPUT_TOKENS = 8192

let cachedSystemPrompt: string | undefined

function loadSystemPrompt(): string {
  // The prompt file ends with dated maintenance notes in HTML comments — those
  // are for humans, not for the model.
  cachedSystemPrompt ??= readFileSync(join(process.cwd(), 'prompts', 'parse-recipe.md'), 'utf-8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
  return cachedSystemPrompt
}

/**
 * Replaces whatever nutrition the parsing step produced with values computed
 * ingredient by ingredient (see lib/nutrition/engine.ts). The model's own
 * whole-dish guess is kept only as a cross-check and last-resort fallback.
 */
export async function withNutrition(recipe: Recipe, provider?: LLMProvider): Promise<Recipe> {
  const { nutrition, meta } = await computeNutrition(recipe, { provider, dishEstimate: recipe.nutrition })

  // Provenance and caveats travel in nutritionMeta, so any note the model wrote
  // about its own nutrition guess is now redundant (or plain wrong).
  const warnings = recipe.warnings.filter((w) => !/nutrici/i.test(w))
  if (!nutrition) warnings.push('No se pudieron calcular los valores nutricionales')

  return { ...recipe, nutrition, nutritionMeta: meta, warnings }
}

export async function processRecipe(rawInput: string, providerName?: LLMProvider): Promise<Recipe> {
  if (!rawInput.trim()) {
    throw new RecipeProcessingError('EMPTY_CONTENT', 'No hay contenido que procesar')
  }

  // Truncate to prevent cost-amplification; strip C0/C1 control chars (except \t \n \r)
  // to block prompt injection attempts that rely on hidden/invisible characters.
  const input = rawInput
    .slice(0, MAX_INPUT_CHARS)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // NON-AI MODE: heuristic parser, nutrition from the databases only.
  if (getAvailableProviders().length === 0) {
    return withNutrition(parseText(input))
  }

  const llm = providerName ? getLLMProviderByName(providerName) : getLLMProvider()

  let result: { text: string; provider: string }
  try {
    result = await llm.complete([
      { role: 'system', content: loadSystemPrompt() },
      { role: 'user', content: input },
    ], { temperature: 0, jsonMode: true, maxTokens: MAX_OUTPUT_TOKENS })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'LLM call failed'
    throw new RecipeProcessingError(
      'AI_EXTRACTION_FAILED',
      'El modelo de IA no respondió. Inténtalo de nuevo en unos segundos.',
      detail,
    )
  }

  const parsed = parseLLMJson(result.text)
  if (parsed === undefined) {
    const jsonText = extractJSON(result.text)
    // A response cut off by the output-token limit never closes its root object.
    const truncated = jsonText.startsWith('{') && !jsonText.endsWith('}')
    throw new RecipeProcessingError(
      'PARSING_FAILED',
      truncated
        ? `[${result.provider}] La respuesta del modelo se cortó a medias. Prueba con una receta más corta.`
        : `[${result.provider}] El modelo no devolvió un JSON válido. Inténtalo de nuevo.`,
      jsonText.slice(0, 800),
    )
  }

  const unwrapped = unwrapRecipe(parsed)
  const normalized = typeof unwrapped === 'object' && unwrapped !== null && !Array.isArray(unwrapped)
    ? normalizeLLMOutput(unwrapped as Record<string, unknown>)
    : unwrapped
  const validated = RecipeSchema.safeParse(stripNulls(normalized))

  if (!validated.success) {
    const issues = validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new RecipeProcessingError(
      'AI_EXTRACTION_FAILED',
      `[${result.provider}] La respuesta del modelo no tiene el formato de receta esperado.`,
      `Schema validation failed: ${issues}\n\nRaw LLM output:\n${extractJSON(result.text).slice(0, 800)}`,
    )
  }

  const recipe: Recipe = {
    ...validated.data,
    ingredients: normalizeIngredients(validated.data.ingredients),
  }

  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    const missing = recipe.ingredients.length === 0 ? 'ingredientes' : 'pasos'
    throw new RecipeProcessingError(
      'AI_EXTRACTION_FAILED',
      `[${result.provider}] No se han encontrado ${missing} en el contenido. ¿Seguro que es una receta?`,
    )
  }

  return withNutrition(recipe, providerName)
}
