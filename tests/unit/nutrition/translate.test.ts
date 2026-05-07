import { describe, expect, it } from 'vitest'
import { normalizeForLookup, translateIngredient } from '@/lib/nutrition/translate'

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

  it('translates after removing modifiers', () => {
    expect(translateIngredient('tomate fresco picado')).toBe('tomato')
  })

  it('falls back to shorter matching phrases', () => {
    expect(translateIngredient('harina de trigo blanca')).toBe('wheat flour')
  })

  it('falls back word by word when there is no phrase match', () => {
    expect(translateIngredient('powder ajo')).toBe('powder garlic')
  })

  it('returns the original input when normalization becomes empty', () => {
    expect(translateIngredient('  ')).toBe('  ')
  })
})
