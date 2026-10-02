import { describe, it, expect } from 'vitest'
import {
    extractJSON,
    parseLLMJson,
    unwrapRecipe,
    normalizeLLMOutput,
    stripNulls,
    normalizeIngredients,
} from '@/lib/llm-output'

describe('extractJSON', () => {
    it('returns plain JSON as-is', () => {
        const json = '{"title":"Tortilla"}'
        expect(extractJSON(json)).toBe(json)
    })

    it('extracts JSON from ```json fenced block', () => {
        const text = '```json\n{"title":"Tortilla"}\n```'
        expect(extractJSON(text)).toBe('{"title":"Tortilla"}')
    })

    it('extracts JSON from ``` fenced block (no language tag)', () => {
        const text = '```\n{"title":"Receta"}\n```'
        expect(extractJSON(text)).toBe('{"title":"Receta"}')
    })

    it('extracts first {...} block when LLM prepends prose', () => {
        const text = 'Here is the recipe:\n{"title":"Sopa","ingredients":[]}'
        expect(extractJSON(text)).toBe('{"title":"Sopa","ingredients":[]}')
    })

    it('trims whitespace from extracted JSON', () => {
        const text = '  {"title":"X"}  '
        expect(extractJSON(text).trim()).toBe('{"title":"X"}')
    })

    it('handles multi-line JSON object', () => {
        const text = '{\n  "title": "Paella",\n  "ingredients": []\n}'
        const result = extractJSON(text)
        expect(result).toContain('"title"')
    })
})

describe('unwrapRecipe', () => {
    it('returns recipe object as-is when it has title + ingredients', () => {
        const recipe = { title: 'Tortilla', ingredients: [] }
        expect(unwrapRecipe(recipe)).toBe(recipe)
    })

    it('unwraps {"recipe":{...}} wrapper', () => {
        const inner = { title: 'Tortilla', ingredients: [] }
        const wrapped = { recipe: inner }
        expect(unwrapRecipe(wrapped)).toEqual(inner)
    })

    it('unwraps {"receta":{...}} wrapper (Spanish key)', () => {
        const inner = { title: 'Sopa', ingredients: [] }
        const wrapped = { receta: inner }
        expect(unwrapRecipe(wrapped)).toEqual(inner)
    })

    it('unwraps object when inner value has array ingredients', () => {
        const inner = { ingredients: [{ name: 'sal' }] }
        const wrapped = { data: inner }
        expect(unwrapRecipe(wrapped)).toEqual(inner)
    })

    it('returns null unchanged', () => {
        expect(unwrapRecipe(null)).toBeNull()
    })

    it('returns arrays unchanged', () => {
        const arr = [1, 2, 3]
        expect(unwrapRecipe(arr)).toBe(arr)
    })
})

describe('normalizeLLMOutput — field aliases', () => {
    it('maps "recipeName" → "title"', () => {
        const result = normalizeLLMOutput({ recipeName: 'Paella', ingredients: [], steps: [] })
        expect(result.title).toBe('Paella')
        expect(result.recipeName).toBeUndefined()
    })

    it('maps "nombre" → "title"', () => {
        const result = normalizeLLMOutput({ nombre: 'Arroz', ingredients: [], steps: [] })
        expect(result.title).toBe('Arroz')
    })

    it('maps "recipe_name" → "title"', () => {
        const result = normalizeLLMOutput({ recipe_name: 'Gazpacho', ingredients: [], steps: [] })
        expect(result.title).toBe('Gazpacho')
    })

    it('maps "pasos" → "steps"', () => {
        const result = normalizeLLMOutput({ title: 'X', ingredients: [], pasos: [{ order: 1, instruction: 'mezclar' }] })
        expect(result.steps).toBeDefined()
        expect(result.pasos).toBeUndefined()
    })

    it('maps "preparationSteps" → "steps"', () => {
        const result = normalizeLLMOutput({ title: 'X', ingredients: [], preparationSteps: [] })
        expect(result.steps).toBeDefined()
    })

    it('maps "ingredientes" → "ingredients"', () => {
        const result = normalizeLLMOutput({ title: 'X', ingredientes: [{ name: 'sal' }], steps: [] })
        expect(result.ingredients).toBeDefined()
        expect(result.ingredientes).toBeUndefined()
    })

    it('does not overwrite "title" if already present', () => {
        const result = normalizeLLMOutput({ title: 'Correcto', recipeName: 'Alternativo', ingredients: [], steps: [] })
        expect(result.title).toBe('Correcto')
    })
})

describe('normalizeLLMOutput — steps coercion', () => {
    it('converts array of strings to step objects', () => {
        const result = normalizeLLMOutput({
            title: 'X', ingredients: [],
            steps: ['Mezclar', 'Hornear'],
        })
        const steps = result.steps as Array<{ order: number; instruction: string }>
        expect(steps[0]).toEqual({ order: 1, instruction: 'Mezclar' })
        expect(steps[1]).toEqual({ order: 2, instruction: 'Hornear' })
    })

    it('converts numeric-keyed step dict to array', () => {
        const result = normalizeLLMOutput({
            title: 'X', ingredients: [],
            steps: { '1': 'Mezclar', '2': 'Hornear' },
        })
        const steps = result.steps as Array<{ order: number; instruction: string }>
        expect(steps).toHaveLength(2)
        expect(steps[0].instruction).toBe('Mezclar')
    })

    it('normalises step object with "description" key to "instruction"', () => {
        const result = normalizeLLMOutput({
            title: 'X', ingredients: [],
            steps: [{ order: 1, description: 'Mezclar' }],
        })
        const steps = result.steps as Array<{ order: number; instruction: unknown }>
        expect(steps[0].instruction).toBe('Mezclar')
    })
})

describe('normalizeLLMOutput — ingredients dict coercion', () => {
    it('converts {"name": "qty unit"} dict to ingredient array', () => {
        const result = normalizeLLMOutput({
            title: 'X', steps: [],
            ingredients: { 'harina': '200 g', 'sal': '1 tsp' },
        })
        const ings = result.ingredients as Array<{ name: string; quantity?: string; unit?: string }>
        expect(ings).toHaveLength(2)
        expect(ings.find(i => i.name === 'harina')).toMatchObject({ quantity: '200', unit: 'g' })
    })

    it('handles numeric value as grams', () => {
        const result = normalizeLLMOutput({
            title: 'X', steps: [],
            ingredients: { 'azúcar': 100 },
        })
        const ings = result.ingredients as Array<{ name: string; quantity?: string; unit?: string }>
        expect(ings[0]).toMatchObject({ name: 'azúcar', quantity: '100', unit: 'g' })
    })

    it('returns ingredient without quantity when value is "-"', () => {
        const result = normalizeLLMOutput({
            title: 'X', steps: [],
            ingredients: { 'al gusto': '-' },
        })
        const ings = result.ingredients as Array<{ name: string; quantity?: string }>
        expect(ings[0].name).toBe('al gusto')
        expect(ings[0].quantity).toBeUndefined()
    })
})

describe('stripNulls', () => {
    it('removes null values from objects', () => {
        const result = stripNulls({ a: 'hello', b: null }) as Record<string, unknown>
        expect(result.a).toBe('hello')
        expect('b' in result).toBe(false)
    })

    it('strips nulls recursively', () => {
        const result = stripNulls({ outer: { inner: null, keep: 1 } }) as Record<string, Record<string, unknown>>
        expect(result.outer.keep).toBe(1)
        expect('inner' in result.outer).toBe(false)
    })

    it('strips nulls inside arrays', () => {
        const result = stripNulls([{ a: null, b: 2 }]) as Array<Record<string, unknown>>
        expect('a' in result[0]).toBe(false)
        expect(result[0].b).toBe(2)
    })

    it('returns primitive values unchanged', () => {
        expect(stripNulls('hello')).toBe('hello')
        expect(stripNulls(42)).toBe(42)
        expect(stripNulls(true)).toBe(true)
    })
})

describe('normalizeIngredients', () => {
    it('splits embedded unit from quantity when no separate unit', () => {
        const result = normalizeIngredients([{ name: 'harina', quantity: '200 g', unit: undefined }])
        expect(result[0].quantity).toBe('200')
        expect(result[0].unit).toBe('g')
    })

    it('strips unit from quantity when separate unit already exists', () => {
        const result = normalizeIngredients([{ name: 'harina', quantity: '200 g', unit: 'g' }])
        expect(result[0].quantity).toBe('200')
        expect(result[0].unit).toBe('g')
    })

    it('leaves ingredient untouched when no embedded unit', () => {
        const result = normalizeIngredients([{ name: 'sal', quantity: '1', unit: 'tsp' }])
        expect(result[0].quantity).toBe('1')
        expect(result[0].unit).toBe('tsp')
    })

    it('handles ingredient with no quantity', () => {
        const result = normalizeIngredients([{ name: 'al gusto' }])
        expect(result[0].name).toBe('al gusto')
        expect(result[0].quantity).toBeUndefined()
    })

    it('processes multiple ingredients', () => {
        const result = normalizeIngredients([
            { name: 'harina', quantity: '500 gr', unit: undefined },
            { name: 'agua', quantity: '250', unit: 'ml' },
        ])
        expect(result[0].unit).toBe('g')
        expect(result[1].unit).toBe('ml')
    })
})

describe('normalizeIngredients — display units', () => {
    it('keeps the recipe wording for non-metric units', () => {
        const result = normalizeIngredients([{ name: 'harina', quantity: '2 tazas' }])
        expect(result[0]).toMatchObject({ quantity: '2', unit: 'tazas' })
    })

    it('normalises metric abbreviations', () => {
        const result = normalizeIngredients([{ name: 'leche', quantity: '250 mililitros' }])
        expect(result[0]).toMatchObject({ quantity: '250', unit: 'ml' })
    })

    it('keeps the nutrition hints that came with the ingredient', () => {
        const result = normalizeIngredients([{ name: 'harina', quantity: '200 g', nameEn: 'flour', grams: 200 }])
        expect(result[0]).toMatchObject({ nameEn: 'flour', grams: 200 })
    })
})

describe('parseLLMJson', () => {
    it('parses fenced JSON', () => {
        expect(parseLLMJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    })

    it('returns undefined instead of throwing on invalid JSON', () => {
        expect(parseLLMJson('Lo siento, no puedo ayudarte')).toBeUndefined()
        expect(parseLLMJson('{"title": "Cortado a medi')).toBeUndefined()
    })
})

describe('normalizeLLMOutput — engine-owned fields', () => {
    it('drops a nutritionMeta block invented by the model', () => {
        const result = normalizeLLMOutput({ title: 'X', ingredients: [], steps: [], nutritionMeta: { source: 'usda' } })
        expect('nutritionMeta' in result).toBe(false)
    })
})

describe('unwrapRecipe — aliased field names', () => {
    it('unwraps a wrapper whose recipe uses Spanish field names', () => {
        const inner = { nombre: 'Gazpacho', ingredientes: { tomate: '1 kg' }, pasos: ['Triturar'] }
        expect(unwrapRecipe({ receta: inner })).toBe(inner)
    })

    it('does not mistake an ingredients dictionary for the recipe', () => {
        const recipe = { nombre: 'Gazpacho', ingredientes: { tomate: '1 kg' } }
        expect(unwrapRecipe(recipe)).toBe(recipe)
    })
})
