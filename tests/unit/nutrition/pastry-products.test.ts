import { describe, expect, it } from 'vitest'
import { foodKey } from '@/lib/nutrition/normalize'
import { findPastryProduct, PASTRY_PRODUCTS } from '@/lib/nutrition/pastry-products'
import { findReferenceFood } from '@/lib/nutrition/reference-foods'
import { NUTRIENT_KEYS } from '@/lib/nutrition/types'

describe('pastry products table', () => {
  it('stores aliases already normalised and without duplicates', () => {
    const all = PASTRY_PRODUCTS.flatMap((p) => p.aliases)
    expect(new Set(all).size).toBe(all.length)
    for (const alias of all) expect(foodKey(alias, { stripModifiers: false }), alias).toBe(alias)
  })

  it('has a complete, physically plausible profile for every product', () => {
    for (const { description, per100g } of PASTRY_PRODUCTS) {
      for (const key of NUTRIENT_KEYS) expect(per100g[key], `${description} ${key}`).not.toBeNull()
      const { calories, protein, fat, carbohydrates, water, fiber, sugar } = per100g
      expect(calories, description).toBeGreaterThanOrEqual(0)
      expect(calories, description).toBeLessThanOrEqual(900)
      // USDA convention: fibre and sugar are part of total carbohydrate
      expect(protein! + fat! + carbohydrates! + water!, description).toBeLessThanOrEqual(105)
      expect(fiber!, description).toBeLessThanOrEqual(carbohydrates!)
      expect(sugar!, description).toBeLessThanOrEqual(carbohydrates!)
    }
  })

  it('does not shadow foods the USDA snapshot already covers', () => {
    for (const { aliases } of PASTRY_PRODUCTS) {
      for (const alias of aliases) expect(findReferenceFood(alias), alias).toBeUndefined()
    }
  })

  it('reports alcohol as grams, so Atwater energy stays consistent', () => {
    const spirit = findPastryProduct('vodka')!
    expect(spirit.per100g.alcohol).toBe(33)
    expect(spirit.per100g.calories).toBeCloseTo(7 * 33, -1)
  })
})

describe('findPastryProduct', () => {
  it('matches brand names and technical sugars by exact normalised name', () => {
    expect(findPastryProduct('Manjari 64%')?.description).toContain('Manjari')
    expect(findPastryProduct('IVOIRE')?.per100g.calories).toBe(557)
    expect(findPastryProduct('glucosa en polvo')?.description).toContain('Glucosa atomizada')
    expect(findPastryProduct('Hojas de gelatina')).toBeUndefined() // real gelatine lives in the USDA snapshot
  })

  it('accepts plural and accented spellings', () => {
    expect(findPastryProduct('Pralinés de avellana')).toBe(findPastryProduct('praline avellana'))
    expect(findPastryProduct('Pectinas NH')?.description).toBe('Pectina')
  })

  it('tries each candidate name in order and ignores empties', () => {
    expect(findPastryProduct(undefined, '', 'xantana')?.description).toBe('Goma xantana')
    expect(findPastryProduct('chocolate')).toBeUndefined() // generic names go to USDA
  })
})
