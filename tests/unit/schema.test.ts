import { describe, it, expect } from 'vitest'
import { RecipeSchema, RecipeSaveSchema, IngredientSchema, StepSchema, NutritionSchema } from '@/lib/schema'

const minimalRecipe = {
    title: 'Tortilla',
    categories: [],
    ingredients: [{ name: 'Huevo' }],
    steps: [{ order: 1, instruction: 'Batir' }],
    tags: [],
    confidence: 'high' as const,
    warnings: [],
}

describe('RecipeSchema', () => {
    // ── Valid ─────────────────────────────────────────────────────────────────
    it('accepts a minimal valid recipe', () => {
        expect(RecipeSchema.safeParse(minimalRecipe).success).toBe(true)
    })

    it('accepts a recipe with empty ingredients and steps', () => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, ingredients: [], steps: [] })
        expect(result.success).toBe(true)
    })

    it('accepts all optional fields', () => {
        const full = {
            ...minimalRecipe,
            description: 'Desc',
            servings: 4,
            prepTime: '10 min',
            cookTime: '20 min',
            totalTime: '30 min',
            cuisine: 'Española',
            difficulty: 'easy',
            sourceUrl: 'https://example.com/recipe',
            imageUrl: 'https://example.com/img.jpg',
            estimatedCost: 3.5,
        }
        expect(RecipeSchema.safeParse(full).success).toBe(true)
    })

    // ── Difficulty coercion ───────────────────────────────────────────────────
    it.each([
        ['easy', 'easy'],
        ['fácil', 'easy'],
        ['facil', 'easy'],
        ['simple', 'easy'],
        ['bajo', 'easy'],
        ['baja', 'easy'],
        ['low', 'easy'],
        ['medium', 'medium'],
        ['medio', 'medium'],
        ['media', 'medium'],
        ['moderate', 'medium'],
        ['normal', 'medium'],
        ['intermediate', 'medium'],
        ['hard', 'hard'],
        ['difícil', 'hard'],
        ['dificil', 'hard'],
        ['difficult', 'hard'],
        ['alto', 'hard'],
        ['alta', 'hard'],
        ['high', 'hard'],
        ['advanced', 'hard'],
    ])('coerces difficulty "%s" → "%s"', (input, expected) => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, difficulty: input })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.difficulty).toBe(expected)
    })

    it('rejects unknown difficulty values', () => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, difficulty: 'superhigh' })
        expect(result.success).toBe(false)
    })

    it('accepts missing difficulty (optional)', () => {
        const { difficulty: _, ...nodifficulty } = { ...minimalRecipe, difficulty: undefined }
        expect(RecipeSchema.safeParse(nodifficulty).success).toBe(true)
    })

    // ── Servings coercion ─────────────────────────────────────────────────────
    it('coerces string servings "4" to number 4', () => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, servings: '4' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.servings).toBe(4)
    })

    it('coerces servings "0" to undefined', () => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, servings: '0' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.servings).toBeUndefined()
    })

    it('coerces servings "" to undefined', () => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, servings: '' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.servings).toBeUndefined()
    })

    it('coerces servings null to undefined', () => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, servings: null })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.servings).toBeUndefined()
    })

    it('accepts positive integer servings', () => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, servings: 2 })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.servings).toBe(2)
    })

    // ── Arrays coerced from numeric-keyed objects ─────────────────────────────
    it('coerces numeric-keyed ingredient object to array', () => {
        const result = RecipeSchema.safeParse({
            ...minimalRecipe,
            ingredients: { '0': { name: 'harina' }, '1': { name: 'agua' } },
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.ingredients).toHaveLength(2)
            expect(result.data.ingredients[0].name).toBe('harina')
            expect(result.data.ingredients[1].name).toBe('agua')
        }
    })

    it('coerces numeric-keyed step object to array', () => {
        const result = RecipeSchema.safeParse({
            ...minimalRecipe,
            steps: { '0': { order: 1, instruction: 'mezclar' }, '1': { order: 2, instruction: 'hornear' } },
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.steps).toHaveLength(2)
    })

    it('wraps single ingredient object in an array', () => {
        const result = RecipeSchema.safeParse({
            ...minimalRecipe,
            ingredients: { name: 'sal' },
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.ingredients).toHaveLength(1)
    })

    // ── Confidence ───────────────────────────────────────────────────────────
    it.each(['high', 'medium', 'low'])('accepts confidence "%s"', (val) => {
        const result = RecipeSchema.safeParse({ ...minimalRecipe, confidence: val })
        expect(result.success).toBe(true)
    })

    it('defaults confidence to "high" when not provided', () => {
        const { confidence: _, ...noConf } = { ...minimalRecipe }
        const result = RecipeSchema.safeParse(noConf)
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.confidence).toBe('high')
    })
})

describe('RecipeSaveSchema', () => {
    it('accepts a valid recipe with ingredients and steps', () => {
        expect(RecipeSaveSchema.safeParse(minimalRecipe).success).toBe(true)
    })

    it('rejects empty title', () => {
        const result = RecipeSaveSchema.safeParse({ ...minimalRecipe, title: '' })
        expect(result.success).toBe(false)
    })

    it('rejects empty ingredients array', () => {
        const result = RecipeSaveSchema.safeParse({ ...minimalRecipe, ingredients: [] })
        expect(result.success).toBe(false)
    })

    it('rejects empty steps array', () => {
        const result = RecipeSaveSchema.safeParse({ ...minimalRecipe, steps: [] })
        expect(result.success).toBe(false)
    })
})

describe('IngredientSchema', () => {
    it('accepts ingredient with name only', () => {
        expect(IngredientSchema.safeParse({ name: 'sal' }).success).toBe(true)
    })

    it('accepts ingredient with all fields', () => {
        const result = IngredientSchema.safeParse({ name: 'harina', quantity: '200', unit: 'g', notes: 'tamizada', normalized: 'flour' })
        expect(result.success).toBe(true)
    })

    it('rejects ingredient without name', () => {
        expect(IngredientSchema.safeParse({ quantity: '100', unit: 'g' }).success).toBe(false)
    })
})

describe('StepSchema', () => {
    it('accepts a valid step', () => {
        expect(StepSchema.safeParse({ order: 1, instruction: 'Batir huevos' }).success).toBe(true)
    })

    it('coerces string order "2" to number', () => {
        const result = StepSchema.safeParse({ order: '2', instruction: 'Hornear' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.order).toBe(2)
    })

    it('rejects order 0 (must be positive)', () => {
        expect(StepSchema.safeParse({ order: 0, instruction: 'x' }).success).toBe(false)
    })

    it('accepts optional duration', () => {
        const result = StepSchema.safeParse({ order: 1, instruction: 'cocer', duration: '10 min' })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.duration).toBe('10 min')
    })
})

describe('NutritionSchema', () => {
    it('accepts empty object (all optional)', () => {
        expect(NutritionSchema.safeParse({}).success).toBe(true)
    })

    it('coerces string numbers to numeric', () => {
        const result = NutritionSchema.safeParse({ calories: '250', protein: '10.5' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.calories).toBe(250)
            expect(result.data.protein).toBe(10.5)
        }
    })

    it('rejects negative values', () => {
        const result = NutritionSchema.safeParse({ calories: -10 })
        expect(result.success).toBe(false)
    })
})
