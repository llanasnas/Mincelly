import { describe, expect, it } from 'vitest'
import {
  canonicalUnit,
  displayUnit,
  gramsFromQuantity,
  measure,
  parseAmount,
  parseQuantity,
  scaleQuantity,
  splitLeadingAmount,
} from '@/lib/nutrition/parser'

describe('parseAmount', () => {
  it('reads integers, decimals and decimal commas', () => {
    expect(parseAmount('2')).toBe(2)
    expect(parseAmount('1.5')).toBe(1.5)
    expect(parseAmount('1,5')).toBe(1.5)
  })

  it('reads fractions, mixed numbers and vulgar fractions', () => {
    expect(parseAmount('1/2')).toBe(0.5)
    expect(parseAmount('1 1/2')).toBe(1.5)
    expect(parseAmount('½')).toBe(0.5)
    expect(parseAmount('1½')).toBe(1.5)
    expect(parseAmount('¾')).toBe(0.75)
  })

  it('resolves ranges to their midpoint', () => {
    expect(parseAmount('2-3')).toBe(2.5)
    expect(parseAmount('2 a 3')).toBe(2.5)
    expect(parseAmount('100–150')).toBe(125)
  })

  it('returns null for text, empty input and division by zero', () => {
    expect(parseAmount('al gusto')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount(null)).toBeNull()
    expect(parseAmount('1/0')).toBeNull()
  })
})

describe('canonicalUnit', () => {
  it('maps Spanish and English spellings to one canonical unit', () => {
    expect(canonicalUnit('Cucharadas')).toBe('tbsp')
    expect(canonicalUnit('cucharada')).toBe('tbsp')
    expect(canonicalUnit('cucharadita')).toBe('tsp')
    expect(canonicalUnit('gr.')).toBe('g')
    expect(canonicalUnit('Gramos')).toBe('g')
    expect(canonicalUnit('tazas')).toBe('cup')
    expect(canonicalUnit('dientes')).toBe('clove')
    expect(canonicalUnit('puñado')).toBe('handful')
  })

  it('returns null for units it does not know', () => {
    expect(canonicalUnit('sobre')).toBeNull()
    expect(canonicalUnit('')).toBeNull()
    expect(canonicalUnit(null)).toBeNull()
  })
})

describe('displayUnit', () => {
  it('normalises metric units but keeps the wording of everything else', () => {
    expect(displayUnit(parseQuantity('500 gr'))).toBe('g')
    expect(displayUnit(parseQuantity('2 tazas'))).toBe('tazas')
    expect(displayUnit(parseQuantity('3 dientes'))).toBe('dientes')
    expect(displayUnit(parseQuantity('2'))).toBeNull()
  })
})

describe('measure', () => {
  it('returns null when the quantity is missing or cannot be parsed', () => {
    expect(measure(null, null, 'agua')).toBeNull()
    expect(measure('a ojo', null, 'agua')).toBeNull()
    expect(measure('0', 'g', 'harina')).toBeNull()
  })

  it('converts mass units exactly', () => {
    expect(measure('1', 'kg', 'harina')).toEqual({ grams: 1000, kind: 'mass', confident: true })
    expect(measure('2', 'oz', 'azúcar')?.grams).toBeCloseTo(56.7)
    expect(measure('1', 'lb', 'azúcar')?.grams).toBeCloseTo(453.6)
  })

  // The bug this guards against: units arrive as the recipe wrote them
  // ("cucharadas", "gramos"), and used to convert to nothing at all.
  it('understands units exactly as an LLM returns them', () => {
    expect(measure('200', 'gramos', 'harina')?.grams).toBe(200)
    expect(measure('2', 'cucharadas', 'aceite de oliva')?.grams).toBeCloseTo(27.6)
    expect(measure('1', 'taza', 'azúcar')?.grams).toBeCloseTo(204)
    expect(measure('1', 'Vaso', 'leche')?.grams).toBeCloseTo(206)
  })

  it('uses ingredient densities for volumes and flags generic conversions', () => {
    expect(measure('1', 'cup', 'harina')).toMatchObject({ kind: 'volume', confident: true })
    expect(measure('1', 'cup', 'harina')?.grams).toBeCloseTo(127.2)
    expect(measure('2', 'tbsp', 'miel')?.grams).toBeCloseTo(42.6)
    expect(measure('100', 'ml', 'licor de hierbas')).toEqual({ grams: 100, kind: 'volume', confident: false })
  })

  it('does not confuse "sal" with "salsa" or "salmón"', () => {
    expect(measure('1', 'tsp', 'sal')?.grams).toBeCloseTo(6)
    expect(measure('100', 'ml', 'salsa de tomate')?.grams).toBeCloseTo(103)
    expect(measure('100', 'ml', 'salsa barbacoa')).toMatchObject({ grams: 100, confident: false })
  })

  it('splits a unit glued to the quantity', () => {
    expect(measure('1500 gr', null, 'harina')?.grams).toBe(1500)
    expect(measure('250ml', undefined, 'agua')?.grams).toBe(250)
  })

  it('weighs counted ingredients it knows', () => {
    expect(measure('2', null, 'huevo')).toEqual({ grams: 110, kind: 'count', confident: true })
    expect(measure('3', 'dientes', 'ajo')?.grams).toBe(12)
    expect(measure('2', 'unidades', 'tomate')?.grams).toBe(240)
    expect(measure('2', 'rebanadas', 'pan de molde')?.grams).toBe(60)
    expect(measure('2', 'hojas', 'laurel')?.grams).toBeCloseTo(0.4)
    expect(measure('1', 'pizca', 'sal')?.grams).toBeCloseTo(0.4)
  })

  it('refuses to guess the weight of counted ingredients it does not know', () => {
    // A default here used to turn "1 pollo" or "2 hojas de laurel" into round hundreds of grams.
    expect(measure('2', null, 'ingrediente misterioso')).toBeNull()
    expect(measure('1', null, 'pollo entero')).toBeNull()
  })

  it('returns null for unknown units', () => {
    expect(measure('1', 'sobre', 'levadura')).toBeNull()
    expect(measure('1', 'lata', 'atún')).toBeNull()
  })

  it('accepts fractions, mixed numbers, decimals and ranges', () => {
    expect(measure('1/2', 'cup', 'agua')?.grams).toBe(120)
    expect(measure('1 1/2', 'cup', 'agua')?.grams).toBe(360)
    expect(measure('1,5', 'l', 'agua')?.grams).toBe(1500)
    expect(measure('2-3', 'kg', 'patatas')?.grams).toBe(2500)
  })
})

describe('gramsFromQuantity', () => {
  it('is measure() reduced to the weight', () => {
    expect(gramsFromQuantity('1', 'kg', 'harina')).toBe(1000)
    expect(gramsFromQuantity(null, null, 'agua')).toBeNull()
  })
})

describe('scaleQuantity', () => {
  it('leaves quantities untouched at factor 1', () => {
    expect(scaleQuantity('1/2', 1)).toBe('1/2')
  })

  it('scales and formats with a decimal comma', () => {
    expect(scaleQuantity('1/2', 3)).toBe('1,5')
    expect(scaleQuantity('200', 0.5)).toBe('100')
    expect(scaleQuantity('1', 1 / 3)).toBe('0,33')
    expect(scaleQuantity('250', 1.5)).toBe('375')
    expect(scaleQuantity('2288', 2)).toBe('4576')
  })

  it('returns non-numeric quantities as they are', () => {
    expect(scaleQuantity('al gusto', 2)).toBe('al gusto')
  })
})

describe('splitLeadingAmount', () => {
  it('separates the amount from the rest of the line', () => {
    expect(splitLeadingAmount('200 g de harina')).toEqual({ amount: '200', rest: 'g de harina' })
    expect(splitLeadingAmount('1 1/2 tazas de leche')).toEqual({ amount: '1 1/2', rest: 'tazas de leche' })
    expect(splitLeadingAmount('500ml caldo')).toEqual({ amount: '500', rest: 'ml caldo' })
  })

  it('returns null when the line does not start with a number', () => {
    expect(splitLeadingAmount('sal al gusto')).toBeNull()
  })
})
