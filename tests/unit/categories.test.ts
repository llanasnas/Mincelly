import { describe, expect, it } from 'vitest'
import { ALL_CATEGORIES, CATEGORIES_BY_TYPE, RECIPE_TYPES } from '@/lib/categories'

describe('categories', () => {
  it('exposes the supported recipe types in order', () => {
    expect(RECIPE_TYPES).toEqual(['cocina', 'pasteleria', 'bebidas'])
  })

  it('defines category lists for every recipe type', () => {
    expect(Object.keys(CATEGORIES_BY_TYPE).sort()).toEqual([...RECIPE_TYPES].sort())
    expect(CATEGORIES_BY_TYPE.cocina.length).toBeGreaterThan(0)
    expect(CATEGORIES_BY_TYPE.pasteleria.length).toBeGreaterThan(0)
    expect(CATEGORIES_BY_TYPE.bebidas.length).toBeGreaterThan(0)
  })

  it('builds ALL_CATEGORIES from cocina and pasteleria only', () => {
    expect(ALL_CATEGORIES).toEqual([
      ...CATEGORIES_BY_TYPE.cocina,
      ...CATEGORIES_BY_TYPE.pasteleria,
    ])
    expect(ALL_CATEGORIES).not.toContain('Batidos')
  })
})
