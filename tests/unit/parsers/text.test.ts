import { describe, it, expect } from 'vitest'
import { parseText } from '@/lib/parsers/text'
import { RecipeProcessingError } from '@/lib/errors'

describe('parseText', () => {
    // ── Errors ────────────────────────────────────────────────────────────────
    it('throws EMPTY_CONTENT for empty string', () => {
        try {
            parseText('')
            expect.fail('should have thrown')
        } catch (err) {
            expect(err).toBeInstanceOf(RecipeProcessingError)
            expect((err as RecipeProcessingError).code).toBe('EMPTY_CONTENT')
        }
    })

    it('throws EMPTY_CONTENT for whitespace-only string', () => {
        try {
            parseText('   \n  \n  ')
            expect.fail('should have thrown')
        } catch (err) {
            expect(err).toBeInstanceOf(RecipeProcessingError)
            expect((err as RecipeProcessingError).code).toBe('EMPTY_CONTENT')
        }
    })

    it('throws PARSING_FAILED when no section headers detected', () => {
        try {
            parseText('Just some random text\nwithout sections')
            expect.fail('should have thrown')
        } catch (err) {
            expect(err).toBeInstanceOf(RecipeProcessingError)
            expect((err as RecipeProcessingError).code).toBe('PARSING_FAILED')
        }
    })

    // ── Basic structure ───────────────────────────────────────────────────────
    it('parses title from first line', () => {
        const result = parseText('Tortilla de patatas\nIngredientes:\n- 4 huevos\nPreparación:\n- Batir huevos')
        expect(result.title).toBe('Tortilla de patatas')
    })

    it('parses ingredients section', () => {
        const result = parseText('Receta\nIngredientes:\n- 4 huevos\n- 200g harina\nPreparación:\n- Mezclar')
        expect(result.ingredients).toHaveLength(2)
        expect(result.ingredients[0].name).toBe('4 huevos')
        expect(result.ingredients[1].name).toBe('200g harina')
    })

    it('parses steps section', () => {
        const result = parseText('Receta\nPreparación:\n1. Mezclar todo\n2. Hornear 30 min')
        expect(result.steps).toHaveLength(2)
        expect(result.steps[0].instruction).toBe('Mezclar todo')
        expect(result.steps[1].instruction).toBe('Hornear 30 min')
    })

    it('assigns sequential order to steps', () => {
        const result = parseText('Receta\nPreparación:\n- Paso uno\n- Paso dos\n- Paso tres')
        expect(result.steps[0].order).toBe(1)
        expect(result.steps[1].order).toBe(2)
        expect(result.steps[2].order).toBe(3)
    })

    // ── Section header variants ───────────────────────────────────────────────
    it('recognises "Ingredientes" header (singular)', () => {
        const result = parseText('Receta\nIngredientes:\n- azúcar\nPreparación:\n- mezclar')
        expect(result.ingredients).toHaveLength(1)
    })

    it('recognises "Preparación" with accent', () => {
        const result = parseText('Receta\nIngredientes:\n- azúcar\nPreparación:\n- mezclar')
        expect(result.steps).toHaveLength(1)
    })

    it('recognises "Preparacion" without accent', () => {
        const result = parseText('Receta\nIngredientes:\n- azúcar\nPreparacion:\n- mezclar')
        expect(result.steps).toHaveLength(1)
    })

    it('recognises "Pasos" header', () => {
        const result = parseText('Receta\nIngredientes:\n- azúcar\nPasos:\n- mezclar')
        expect(result.steps).toHaveLength(1)
    })

    it('recognises "Instructions" (English)', () => {
        const result = parseText('Recipe\nIngredients:\n- sugar\nInstructions:\n- mix')
        expect(result.steps).toHaveLength(1)
    })

    it('recognises "Ingredients" header (English)', () => {
        const result = parseText('Recipe\nIngredients:\n- sugar\nInstructions:\n- mix')
        expect(result.ingredients).toHaveLength(1)
    })

    it('recognises "Method" header (English)', () => {
        const result = parseText('Recipe\nIngredients:\n- flour\nMethod:\n- bake')
        expect(result.steps).toHaveLength(1)
    })

    // ── Bullet format variants ────────────────────────────────────────────────
    it('strips "- " bullet prefix', () => {
        const result = parseText('R\nIngredientes:\n- mantequilla\nPreparación:\n- hornear')
        expect(result.ingredients[0].name).toBe('mantequilla')
    })

    it('strips "* " bullet prefix', () => {
        const result = parseText('R\nIngredientes:\n* azúcar\nPreparación:\n* mezclar')
        expect(result.ingredients[0].name).toBe('azúcar')
    })

    it('strips "• " bullet prefix', () => {
        const result = parseText('R\nIngredientes:\n• sal\nPreparación:\n• añadir')
        expect(result.ingredients[0].name).toBe('sal')
    })

    it('strips "1. " numbered bullet prefix', () => {
        const result = parseText('R\nIngredientes:\n1. harina\nPreparación:\n1. mezclar')
        expect(result.ingredients[0].name).toBe('harina')
    })

    it('strips "1) " numbered bullet prefix', () => {
        const result = parseText('R\nIngredientes:\n1) harina\nPreparación:\n1) mezclar')
        expect(result.ingredients[0].name).toBe('harina')
    })

    // ── Default title ─────────────────────────────────────────────────────────
    it('uses "Receta importada" when title cannot be determined', () => {
        // No line before the first section header
        const result = parseText('Ingredientes:\n- azúcar\nPreparación:\n- mezclar')
        expect(result.title).toBe('Receta importada')
    })

    // ── Warnings ─────────────────────────────────────────────────────────────
    it('always includes "Parsed without AI" warning', () => {
        const result = parseText('R\nIngredientes:\n- azúcar\nPreparación:\n- mezclar')
        expect(result.warnings.some(w => w.includes('Parsed without AI'))).toBe(true)
    })

    it('adds warning when no ingredients detected', () => {
        const result = parseText('R\nPreparación:\n- mezclar todo')
        expect(result.warnings.some(w => w.toLowerCase().includes('ingredient'))).toBe(true)
        expect(result.ingredients).toHaveLength(0)
    })

    it('adds warning when no steps detected', () => {
        const result = parseText('R\nIngredientes:\n- azúcar')
        expect(result.warnings.some(w => w.toLowerCase().includes('step'))).toBe(true)
        expect(result.steps).toHaveLength(0)
    })

    // ── Output shape ─────────────────────────────────────────────────────────
    it('always returns confidence "low"', () => {
        const result = parseText('R\nIngredientes:\n- azúcar\nPreparación:\n- mezclar')
        expect(result.confidence).toBe('low')
    })

    it('returns empty categories array', () => {
        const result = parseText('R\nIngredientes:\n- azúcar\nPreparación:\n- mezclar')
        expect(result.categories).toEqual([])
    })

    it('returns empty tags array', () => {
        const result = parseText('R\nIngredientes:\n- azúcar\nPreparación:\n- mezclar')
        expect(result.tags).toEqual([])
    })
})
