import { RECIPE_TYPES, type RecipeType } from './categories'
import type { RecipeFilters } from './db'

const MAX_QUERY_LENGTH = 100
const MAX_LIST_ITEMS = 10

type RawValue = string | null | undefined

function parseList(raw: RawValue): string[] | undefined {
  const items = raw?.split(',').map((item) => item.trim()).filter(Boolean).slice(0, MAX_LIST_ITEMS)
  return items?.length ? items : undefined
}

/**
 * Turns the list's URL parameters into typed filters. Shared by the home page
 * and GET /api/recipes so both read the query string the same way.
 */
export function parseRecipeFilters(raw: {
  q?: RawValue
  type?: RawValue
  categories?: RawValue
  ingredients?: RawValue
}): RecipeFilters {
  return {
    type: RECIPE_TYPES.includes(raw.type as RecipeType) ? (raw.type as RecipeType) : undefined,
    query: raw.q?.trim().slice(0, MAX_QUERY_LENGTH) || undefined,
    categories: parseList(raw.categories),
    ingredients: parseList(raw.ingredients)?.map((name) => name.toLowerCase()),
  }
}

export function hasActiveFilters(filters: RecipeFilters): boolean {
  return !!(filters.type || filters.query || filters.categories?.length || filters.ingredients?.length)
}
