import { describe, expect, it } from 'vitest'
import { REFERENCE_DATA } from '@/lib/nutrition/reference-data'
import { findReferenceFood } from '@/lib/nutrition/reference-foods'
import { foodKey } from '@/lib/nutrition/normalize'
import { atwaterCalories } from '@/lib/nutrition/usda'

describe('reference data', () => {
  it('has unique fdcIds and aliases', () => {
    const ids = REFERENCE_DATA.map((f) => f.fdcId)
    expect(new Set(ids).size).toBe(ids.length)

    const aliases = REFERENCE_DATA.flatMap((f) => f.aliases)
    expect(new Set(aliases).size).toBe(aliases.length)
  })

  it('stores aliases already normalised, so lookups can match them', () => {
    for (const food of REFERENCE_DATA) {
      for (const alias of food.aliases) {
        expect(foodKey(alias, { stripModifiers: false }), alias).toBe(alias)
      }
    }
  })

  it('has physically plausible values for every food', () => {
    for (const { description, per100g } of REFERENCE_DATA) {
      expect(per100g.calories, description).not.toBeNull()
      expect(per100g.calories!, description).toBeGreaterThanOrEqual(0)
      expect(per100g.calories!, description).toBeLessThanOrEqual(905)

      const mass = (per100g.protein ?? 0) + (per100g.fat ?? 0) + (per100g.carbohydrates ?? 0) +
        (per100g.water ?? 0) + (per100g.alcohol ?? 0)
      expect(mass, description).toBeLessThanOrEqual(102)
    }
  })

  // Catches a wrong fdcId or a nutrient mapped to the wrong column: energy must
  // roughly follow from the macros. Skipped where the general 4/4/9 factors don't
  // apply — fibre-heavy foods (cocoa, spices) and chemical leaveners, whose
  // "carbohydrate" is mostly not digestible.
  it('has energy consistent with its macronutrients', () => {
    for (const { description, per100g } of REFERENCE_DATA) {
      const derived = atwaterCalories(per100g)
      if (derived === null || per100g.calories! < 40) continue
      if ((per100g.fiber ?? 0) >= 15 || description.startsWith('Leavening agents')) continue
      expect(Math.abs(per100g.calories! - derived) / per100g.calories!, description).toBeLessThan(0.25)
    }
  })

  it('pins well-known values', () => {
    expect(findReferenceFood('aceite de oliva')?.per100g).toMatchObject({ calories: 884, fat: 100 })
    expect(findReferenceFood('azúcar')?.per100g.carbohydrates).toBeGreaterThan(99)
    expect(findReferenceFood('agua')?.per100g.calories).toBe(0)
    expect(findReferenceFood('sal')?.per100g.sodium).toBeGreaterThan(38000)
  })
})

describe('findReferenceFood', () => {
  it('matches Spanish names regardless of accents, case and plural', () => {
    expect(findReferenceFood('Huevos')?.description).toBe('Egg, whole, raw, fresh')
    expect(findReferenceFood('LIMONES')?.description).toBe('Lemons, raw, without peel')
    expect(findReferenceFood('nueces')?.description).toBe('Nuts, walnuts, english')
    expect(findReferenceFood('Champiñones')?.description).toBe('Mushrooms, white, raw')
  })

  it('matches English names', () => {
    expect(findReferenceFood('all-purpose flour')?.fdcId).toBe(168894)
    expect(findReferenceFood('eggs')?.fdcId).toBe(171287)
  })

  it('ignores cut and serving descriptors', () => {
    expect(findReferenceFood('cebolla picada fina')).toBeUndefined()
    expect(findReferenceFood('cebolla picada')?.description).toBe('Onions, raw')
    expect(findReferenceFood('aceite de oliva virgen extra')?.fdcId).toBe(171413)
    expect(findReferenceFood('mantequilla derretida')?.fdcId).toBe(173430)
  })

  it('treats connectors as optional', () => {
    expect(findReferenceFood('aceite girasol')?.fdcId).toBe(findReferenceFood('aceite de girasol')?.fdcId)
  })

  // A partial match would silently return the wrong food.
  it('never falls back to a partial match', () => {
    expect(findReferenceFood('harina de espelta')).toBeUndefined()
    expect(findReferenceFood('leche de avena')).toBeUndefined()
    expect(findReferenceFood('queso')).toBeUndefined()
  })

  it('tells apart foods that share a head word', () => {
    expect(findReferenceFood('harina')?.fdcId).toBe(168894)
    expect(findReferenceFood('harina integral')?.fdcId).toBe(168893)
    expect(findReferenceFood('harina de almendra')?.description).toBe('Nuts, almonds')
    expect(findReferenceFood('garbanzos')?.per100g.calories).toBeGreaterThan(300)
    expect(findReferenceFood('garbanzos cocidos')?.per100g.calories).toBeLessThan(200)
  })

  it('prefers an exact name over its stripped form', () => {
    // "rallado" looks like a descriptor, but "pan rallado" is its own food.
    expect(findReferenceFood('pan rallado')?.description).toContain('crumbs')
    expect(findReferenceFood('pan')?.description).toContain('Bread, white')
  })

  it('tries each candidate name in order and skips empty ones', () => {
    expect(findReferenceFood(undefined, null, '', 'huevo')?.fdcId).toBe(171287)
    expect(findReferenceFood('ingrediente raro', 'egg')?.fdcId).toBe(171287)
    expect(findReferenceFood()).toBeUndefined()
  })
})
