import type { Ingredient, Recipe } from '@/lib/schema'
import { RecipeProcessingError } from '@/lib/errors'
import { canonicalUnit, splitLeadingAmount } from '@/lib/nutrition/parser'

/**
 * Heuristic recipe parser — the NON-AI mode.
 * Works on plain text that marks its sections with "Ingredientes" / "Preparación"
 * headers (or their English equivalents).
 */

const INGREDIENTS_RE = /^(ingredientes?|ingredients?)\s*:?\s*$/i
const STEPS_RE = /^(preparaci[oó]n|instrucciones?|pasos?|elaboraci[oó]n|m[eé]todo|steps?|instructions?|directions?|method)\s*:?\s*$/i
const BULLET_RE = /^\s*(\d+[\.\)]\s+|\-\s+|\*\s+|•\s+)/

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim()
}

/**
 * Splits an ingredient line into structured fields:
 *   "200 g de harina"        → { quantity: "200", unit: "g", name: "harina" }
 *   "2 huevos"               → { quantity: "2", name: "huevos" }
 *   "1 cebolla, picada fina" → { quantity: "1", name: "cebolla", notes: "picada fina" }
 *   "sal al gusto"           → { name: "sal al gusto" }
 */
export function parseIngredientLine(line: string): Ingredient {
  const text = line.trim()
  const leading = splitLeadingAmount(text)
  if (!leading || !leading.rest) return withNotes({ name: text })

  // The word after the amount is a unit only if we recognise it as one —
  // otherwise it is the ingredient itself ("2 huevos").
  const [firstWord, ...others] = leading.rest.split(/\s+/)
  if (others.length > 0 && canonicalUnit(firstWord)) {
    const name = others.join(' ').replace(/^(de|del|of)\s+/i, '')
    return withNotes({ quantity: leading.amount, unit: firstWord.replace(/\.$/, ''), name })
  }

  return withNotes({ quantity: leading.amount, name: leading.rest })
}

/** Moves a trailing "(…)" or ", …" remark out of the name and into `notes`. */
function withNotes(ingredient: Ingredient): Ingredient {
  const match = ingredient.name.match(/^(.+?)\s*(?:\(([^)]+)\)|,\s*(.+))\s*$/)
  const name = (match ? match[1] : ingredient.name).trim()
  const notes = match ? (match[2] ?? match[3]).trim() : undefined
  return {
    ...ingredient,
    name,
    ...(notes && { notes }),
    normalized: name.toLowerCase(),
  }
}

export function parseText(rawText: string): Recipe {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

  if (lines.length === 0) {
    throw new RecipeProcessingError('EMPTY_CONTENT', 'No hay texto que procesar')
  }

  let title = ''
  const ingredients: string[] = []
  const steps: string[] = []

  type Section = 'none' | 'ingredients' | 'steps'
  let section: Section = 'none'

  for (const line of lines) {
    if (INGREDIENTS_RE.test(line)) { section = 'ingredients'; continue }
    if (STEPS_RE.test(line)) { section = 'steps'; continue }

    if (!title && section === 'none') { title = line; continue }

    if (section === 'ingredients') ingredients.push(stripBullet(line))
    else if (section === 'steps') steps.push(stripBullet(line))
  }

  if (!title) title = 'Receta importada'

  if (ingredients.length === 0 && steps.length === 0) {
    throw new RecipeProcessingError(
      'PARSING_FAILED',
      'No se han detectado ingredientes ni pasos. Sin IA, el texto necesita los encabezados "Ingredientes" y "Preparación".',
    )
  }

  const warnings: string[] = ['Procesada sin IA: revisa que los datos sean correctos']
  if (ingredients.length === 0) warnings.push('No se han detectado ingredientes')
  if (steps.length === 0) warnings.push('No se han detectado pasos')

  return {
    title,
    categories: [],
    ingredients: ingredients.map(parseIngredientLine),
    steps: steps.map((instruction, idx) => ({ order: idx + 1, instruction })),
    tags: [],
    confidence: 'low',
    warnings,
  }
}
