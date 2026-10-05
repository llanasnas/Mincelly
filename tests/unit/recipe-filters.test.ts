import { describe, expect, it } from 'vitest'
import { parseRecipeId } from '@/lib/db'
import { hasActiveFilters, parseRecipeFilters } from '@/lib/recipe-filters'

describe('parseRecipeFilters', () => {
  it('returns no filters for an empty query string', () => {
    const filters = parseRecipeFilters({})
    expect(filters).toEqual({ type: undefined, query: undefined, categories: undefined, ingredients: undefined })
    expect(hasActiveFilters(filters)).toBe(false)
  })

  it('parses every filter', () => {
    const filters = parseRecipeFilters({
      q: '  tortilla ',
      type: 'cocina',
      categories: 'Primeros, Verduras',
      ingredients: 'Huevo,PATATA',
    })

    expect(filters).toEqual({
      type: 'cocina',
      query: 'tortilla',
      categories: ['Primeros', 'Verduras'],
      ingredients: ['huevo', 'patata'],
    })
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('ignores an unknown recipe type', () => {
    expect(parseRecipeFilters({ type: 'postres' }).type).toBeUndefined()
    expect(parseRecipeFilters({ type: "cocina' OR 1=1" }).type).toBeUndefined()
  })

  it('drops empty list entries', () => {
    expect(parseRecipeFilters({ categories: ',,' }).categories).toBeUndefined()
    expect(parseRecipeFilters({ ingredients: 'ajo,,' }).ingredients).toEqual(['ajo'])
  })

  it('caps list length and search length', () => {
    const many = Array.from({ length: 30 }, (_, i) => `c${i}`).join(',')
    expect(parseRecipeFilters({ categories: many }).categories).toHaveLength(10)
    expect(parseRecipeFilters({ q: 'x'.repeat(500) }).query).toHaveLength(100)
  })

  it('accepts null values, as URLSearchParams.get returns them', () => {
    expect(hasActiveFilters(parseRecipeFilters({ q: null, type: null, categories: null, ingredients: null }))).toBe(false)
  })
})

describe('parseRecipeId', () => {
  it('accepts positive integers', () => {
    expect(parseRecipeId('1')).toBe(1)
    expect(parseRecipeId('27')).toBe(27)
    expect(parseRecipeId('123456789')).toBe(123456789)
  })

  it('rejects anything that is not exactly an id', () => {
    for (const raw of ['', '0', '-3', '12abc', 'abc', '1.5', ' 12', '1e3', '007', '9999999999']) {
      expect(parseRecipeId(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})
