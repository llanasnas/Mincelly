import { describe, expect, it } from 'vitest'
import { gramsFromQuantity } from '@/lib/nutrition/parser'

describe('gramsFromQuantity', () => {
  it('returns null when quantity is missing or cannot be parsed', () => {
    expect(gramsFromQuantity(null, null, 'agua')).toBeNull()
    expect(gramsFromQuantity('a ojo', null, 'agua')).toBeNull()
  })

  it('converts bare counts using ingredient-specific unit weights', () => {
    expect(gramsFromQuantity('2', null, 'huevo')).toBe(120)
  })

  it('falls back to 100g per unit for unknown ingredients without units', () => {
    expect(gramsFromQuantity('2', null, 'ingrediente misterioso')).toBe(200)
  })

  it('converts metric and imperial units to grams', () => {
    expect(gramsFromQuantity('1', 'kg', 'harina')).toBe(1000)
    expect(gramsFromQuantity('2', 'oz', 'azúcar')).toBe(56.7)
    expect(gramsFromQuantity('1', 'lb', 'azúcar')).toBe(453.6)
  })

  it('uses density tables for volume-based conversions', () => {
    expect(gramsFromQuantity('1', 'cup', 'harina')).toBe(132)
    expect(gramsFromQuantity('2', 'tbsp', 'miel')).toBe(42.6)
    expect(gramsFromQuantity('3', 'tsp', 'agua')).toBe(15)
    expect(gramsFromQuantity('1', 'ml', 'ingrediente desconocido')).toBe(1)
  })

  it('converts special count-like units', () => {
    expect(gramsFromQuantity('3', 'clove', 'ajo')).toBe(15)
    expect(gramsFromQuantity('2', 'slice', 'pan')).toBe(60)
    expect(gramsFromQuantity('4', 'leaf', 'laurel')).toBe(8)
    expect(gramsFromQuantity('2', 'unit', 'tomate')).toBe(240)
  })

  it('parses fractions, mixed numbers, and decimals', () => {
    expect(gramsFromQuantity('1/2', 'cup', 'agua')).toBe(120)
    expect(gramsFromQuantity('1 1/2', 'cup', 'agua')).toBe(360)
    expect(gramsFromQuantity('1.5', 'l', 'agua')).toBe(1500)
  })

  it('returns null for unknown units', () => {
    expect(gramsFromQuantity('1', 'dash', 'sal')).toBeNull()
  })
})
