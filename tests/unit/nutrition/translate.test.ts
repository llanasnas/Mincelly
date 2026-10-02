import { describe, expect, it } from 'vitest'
import { foodKey, singularVariants, stripAccents } from '@/lib/nutrition/normalize'
import { normalizeForLookup, translateIngredient } from '@/lib/nutrition/translate'

describe('stripAccents', () => {
  it('lowercases and removes diacritics', () => {
    expect(stripAccents('Azúcar Glacé')).toBe('azucar glace')
    expect(stripAccents('PIÑÓN')).toBe('pinon')
  })
})

describe('foodKey', () => {
  it('strips cut and serving descriptors and normalises whitespace', () => {
    expect(foodKey('  Tomate   fresco   picado  ')).toBe('tomate')
    expect(foodKey('Aceite de oliva virgen extra')).toBe('aceite de oliva')
    expect(foodKey('Cebolla (mediana), pelada')).toBe('cebolla')
  })

  // These words name a different food, with a different nutrient profile.
  it('keeps descriptors that change what the food is', () => {
    expect(foodKey('harina integral')).toBe('harina integral')
    expect(foodKey('tomate seco')).toBe('tomate seco')
    expect(foodKey('garbanzos cocidos')).toBe('garbanzos cocidos')
    expect(foodKey('pan rallado')).toBe('pan rallado')
    expect(foodKey('tomate concentrado')).toBe('tomate concentrado')
  })

  it('can skip modifier stripping', () => {
    expect(foodKey('tomate fresco', { stripModifiers: false })).toBe('tomate fresco')
  })
})

describe('singularVariants', () => {
  it('offers the plausible singular forms of a plural name', () => {
    expect(singularVariants('tomates')).toContain('tomate')
    expect(singularVariants('limones')).toContain('limon')
    expect(singularVariants('nueces')).toContain('nuez')
    expect(singularVariants('strawberries')).toContain('strawberry')
  })

  it('always includes the key itself', () => {
    expect(singularVariants('arroz')).toEqual(['arroz'])
  })
})

describe('normalizeForLookup', () => {
  it('strips modifiers and normalizes whitespace', () => {
    expect(normalizeForLookup('  Tomate   fresco   picado  ')).toBe('tomate')
  })

  it('keeps unmatched words after normalization', () => {
    expect(normalizeForLookup('Pasta artesanal')).toBe('pasta artesanal')
  })
})

describe('translateIngredient', () => {
  it('translates exact whole-phrase matches', () => {
    expect(translateIngredient('aceite de oliva')).toBe('olive oil')
  })

  it('matches regardless of accents', () => {
    expect(translateIngredient('Azucar')).toBe('sugar')
    expect(translateIngredient('azúcar')).toBe('sugar')
  })

  it('translates after removing modifiers', () => {
    expect(translateIngredient('tomate fresco picado')).toBe('tomato')
  })

  it('falls back to shorter matching phrases', () => {
    expect(translateIngredient('harina de trigo blanca')).toBe('wheat flour')
  })

  // The old fallback dropped everything after the first known word, so almond
  // flour was looked up — and costed — as plain wheat flour.
  it('translates "X de Y" compounds instead of truncating them', () => {
    expect(translateIngredient('harina de almendra')).toBe('almond flour')
    expect(translateIngredient('zumo de naranja')).toBe('orange juice')
  })

  it('never reduces an unknown "de …" compound to its head word', () => {
    expect(translateIngredient('harina de espelta')).not.toBe('flour')
  })

  it('falls back word by word when there is no phrase match', () => {
    expect(translateIngredient('powder ajo')).toBe('powder garlic')
  })

  it('returns the original input when normalization becomes empty', () => {
    expect(translateIngredient('  ')).toBe('  ')
  })
})
