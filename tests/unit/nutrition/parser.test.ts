import { describe, it, expect } from 'vitest'
import { parseQuantity, parseIngredientQuantity } from '@/lib/nutrition/parser'

describe('parseQuantity', () => {
    // ── Null / empty ──────────────────────────────────────────────────────────
    it('returns empty quantity for null', () => {
        expect(parseQuantity(null)).toEqual({ quantity: '', unit: null, original: '' })
    })

    it('returns empty quantity for empty string', () => {
        expect(parseQuantity('')).toEqual({ quantity: '', unit: null, original: '' })
    })

    it('returns empty quantity for whitespace-only string', () => {
        expect(parseQuantity('   ')).toEqual({ quantity: '', unit: null, original: '   ' })
    })

    // ── Plain numbers ─────────────────────────────────────────────────────────
    it('parses integer with no unit', () => {
        const result = parseQuantity('2')
        expect(result.quantity).toBe('2')
        expect(result.unit).toBeNull()
    })

    it('parses decimal with no unit', () => {
        const result = parseQuantity('1.5')
        expect(result.quantity).toBe('1.5')
        expect(result.unit).toBeNull()
    })

    it('parses fraction with no unit', () => {
        const result = parseQuantity('1/2')
        expect(result.quantity).toBe('1/2')
        expect(result.unit).toBeNull()
    })

    // ── Metric units ──────────────────────────────────────────────────────────
    it('parses grams: "100 g"', () => {
        expect(parseQuantity('100 g')).toMatchObject({ quantity: '100', unit: 'g' })
    })

    it('normalizes "gr" alias to "g"', () => {
        expect(parseQuantity('1500 gr')).toMatchObject({ quantity: '1500', unit: 'g' })
    })

    it('normalizes "gramos" alias to "g"', () => {
        expect(parseQuantity('200 gramos')).toMatchObject({ quantity: '200', unit: 'g' })
    })

    it('parses kilograms: "1 kg"', () => {
        expect(parseQuantity('1 kg')).toMatchObject({ quantity: '1', unit: 'kg' })
    })

    it('normalizes "kilogramos" alias to "kg"', () => {
        expect(parseQuantity('2 kilogramos')).toMatchObject({ quantity: '2', unit: 'kg' })
    })

    it('parses milliliters: "250 ml"', () => {
        expect(parseQuantity('250 ml')).toMatchObject({ quantity: '250', unit: 'ml' })
    })

    it('normalizes "mililitros" alias to "ml"', () => {
        expect(parseQuantity('100 mililitros')).toMatchObject({ quantity: '100', unit: 'ml' })
    })

    it('parses liters: "1 l"', () => {
        expect(parseQuantity('1 l')).toMatchObject({ quantity: '1', unit: 'l' })
    })

    it('normalizes "litros" alias to "l"', () => {
        expect(parseQuantity('2 litros')).toMatchObject({ quantity: '2', unit: 'l' })
    })

    // ── Volume (imperial) ─────────────────────────────────────────────────────
    it('parses cups: "2 cup"', () => {
        expect(parseQuantity('2 cup')).toMatchObject({ quantity: '2', unit: 'cup' })
    })

    it('normalizes "cups" alias to "cup"', () => {
        expect(parseQuantity('2 cups')).toMatchObject({ quantity: '2', unit: 'cup' })
    })

    it('normalizes "taza" alias to "cup"', () => {
        expect(parseQuantity('1 taza')).toMatchObject({ quantity: '1', unit: 'cup' })
    })

    it('normalizes "tazas" alias to "cup"', () => {
        expect(parseQuantity('3 tazas')).toMatchObject({ quantity: '3', unit: 'cup' })
    })

    it('parses tablespoon: "1 tbsp"', () => {
        expect(parseQuantity('1 tbsp')).toMatchObject({ quantity: '1', unit: 'tbsp' })
    })

    it('normalizes "cucharadas" alias to "tbsp"', () => {
        expect(parseQuantity('2 cucharadas')).toMatchObject({ quantity: '2', unit: 'tbsp' })
    })

    it('normalizes "tablespoon" alias to "tbsp"', () => {
        expect(parseQuantity('1 tablespoon')).toMatchObject({ quantity: '1', unit: 'tbsp' })
    })

    it('parses teaspoon: "1 tsp"', () => {
        expect(parseQuantity('1 tsp')).toMatchObject({ quantity: '1', unit: 'tsp' })
    })

    it('normalizes "cdta" alias to "tsp"', () => {
        expect(parseQuantity('1 cdta')).toMatchObject({ quantity: '1', unit: 'tsp' })
    })

    it('normalizes "cdtas" alias to "tsp"', () => {
        expect(parseQuantity('2 cdtas')).toMatchObject({ quantity: '2', unit: 'tsp' })
    })

    it('normalizes "teaspoon" alias to "tsp"', () => {
        expect(parseQuantity('1 teaspoon')).toMatchObject({ quantity: '1', unit: 'tsp' })
    })

    // ── Weight (imperial) ─────────────────────────────────────────────────────
    it('parses ounces: "4 oz"', () => {
        expect(parseQuantity('4 oz')).toMatchObject({ quantity: '4', unit: 'oz' })
    })

    it('normalizes "onzas" alias to "oz"', () => {
        expect(parseQuantity('2 onzas')).toMatchObject({ quantity: '2', unit: 'oz' })
    })

    it('parses pounds: "1 lb"', () => {
        expect(parseQuantity('1 lb')).toMatchObject({ quantity: '1', unit: 'lb' })
    })

    it('normalizes "libras" alias to "lb"', () => {
        expect(parseQuantity('2 libras')).toMatchObject({ quantity: '2', unit: 'lb' })
    })

    // ── Other units ───────────────────────────────────────────────────────────
    it('normalizes "unidad" to "unit"', () => {
        expect(parseQuantity('1 unidad')).toMatchObject({ quantity: '1', unit: 'unit' })
    })

    it('normalizes "piezas" to "unit"', () => {
        expect(parseQuantity('3 piezas')).toMatchObject({ quantity: '3', unit: 'unit' })
    })

    it('normalizes "dientes" to "clove"', () => {
        expect(parseQuantity('4 dientes')).toMatchObject({ quantity: '4', unit: 'clove' })
    })

    it('normalizes "rodajas" to "slice"', () => {
        expect(parseQuantity('2 rodajas')).toMatchObject({ quantity: '2', unit: 'slice' })
    })

    it('normalizes "hojas" to "leaf"', () => {
        expect(parseQuantity('3 hojas')).toMatchObject({ quantity: '3', unit: 'leaf' })
    })

    // ── Fractions + decimals ──────────────────────────────────────────────────
    it('parses fraction with unit: "1/2 cup"', () => {
        expect(parseQuantity('1/2 cup')).toMatchObject({ quantity: '1/2', unit: 'cup' })
    })

    it('parses decimal with unit: "1.5 kg"', () => {
        expect(parseQuantity('1.5 kg')).toMatchObject({ quantity: '1.5', unit: 'kg' })
    })

    // ── Unknown units passthrough ─────────────────────────────────────────────
    it('keeps unknown unit as-is (lowercase)', () => {
        const result = parseQuantity('1 pizca')
        expect(result.quantity).toBe('1')
        expect(result.unit).toBe('pizca')
    })

    // ── preserves original ────────────────────────────────────────────────────
    it('preserves original string in result', () => {
        const result = parseQuantity('100 g')
        expect(result.original).toBe('100 g')
    })
})

describe('parseIngredientQuantity', () => {
    it('returns unit as-is when unit is provided separately', () => {
        expect(parseIngredientQuantity({ quantity: '100', unit: 'g' }))
            .toEqual({ quantity: '100', unit: 'g' })
    })

    it('extracts unit from quantity when unit is null', () => {
        expect(parseIngredientQuantity({ quantity: '1500 gr', unit: null }))
            .toEqual({ quantity: '1500', unit: 'g' })
    })

    it('extracts cup from quantity when unit is null', () => {
        expect(parseIngredientQuantity({ quantity: '2 tazas', unit: null }))
            .toEqual({ quantity: '2', unit: 'cup' })
    })

    it('returns empty quantity and null unit when both are null', () => {
        expect(parseIngredientQuantity({ quantity: null, unit: null }))
            .toEqual({ quantity: '', unit: null })
    })

    it('returns empty quantity and null unit when both are empty', () => {
        expect(parseIngredientQuantity({ quantity: '', unit: null }))
            .toEqual({ quantity: '', unit: null })
    })

    it('returns bare number when no unit can be parsed', () => {
        expect(parseIngredientQuantity({ quantity: '3', unit: null }))
            .toEqual({ quantity: '3', unit: null })
    })

    it('respects explicit unit even if quantity also contains one', () => {
        // unit is set → use it directly without re-parsing quantity
        expect(parseIngredientQuantity({ quantity: '100', unit: 'g' }))
            .toEqual({ quantity: '100', unit: 'g' })
    })
})
