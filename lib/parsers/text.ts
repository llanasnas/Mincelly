import type { Recipe } from '@/lib/schema'
import { RecipeProcessingError } from '@/lib/errors'

const INGREDIENTS_RE = /^(ingredientes?|ingredients?)\s*:?\s*$/i
const STEPS_RE = /^(preparaci[oó]n|instrucciones?|pasos?|elaboraci[oó]n|m[eé]todo|steps?|instructions?|directions?|method)\s*:?\s*$/i
const BULLET_RE = /^\s*(\d+[\.\)]\s+|\-\s+|\*\s+|•\s+)/

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim()
}

export function parseText(rawText: string): Recipe {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

  if (lines.length === 0) {
    throw new RecipeProcessingError('EMPTY_CONTENT', 'No text content to parse')
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
      'Could not detect ingredients or steps. Use section headers: "Ingredientes" and "Preparación".',
    )
  }

  const warnings: string[] = ['Parsed without AI — review for accuracy']
  if (ingredients.length === 0) warnings.push('No ingredients detected')
  if (steps.length === 0) warnings.push('No steps detected')

  return {
    title,
    categories: [],
    ingredients: ingredients.map(name => ({ name })),
    steps: steps.map((instruction, idx) => ({ order: idx + 1, instruction })),
    tags: [],
    confidence: 'low',
    warnings,
  }
}
