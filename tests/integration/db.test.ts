import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recipe } from '@/lib/schema'

/**
 * Runs lib/db.ts against a real Postgres (PGlite — Postgres compiled to WASM,
 * in-process) with the project's own migrations applied. The Neon HTTP driver is
 * swapped for a thin adapter exposing the same `sql.query(text, params)` call.
 */
const pg = new PGlite()

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({
    query: async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows,
  }),
}))

import {
  deleteRecipe,
  getRecipeById,
  listCategories,
  listIngredients,
  listRecipes,
  saveRecipe,
  updateRecipe,
} from '@/lib/db'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    title: 'Tortilla de patatas',
    type: 'cocina',
    categories: ['Primeros'],
    ingredients: [
      { name: 'Patatas', quantity: '500', unit: 'g', normalized: 'patata' },
      { name: 'Huevos', quantity: '4', normalized: 'huevo' },
    ],
    steps: [{ order: 1, instruction: 'Freír y cuajar' }],
    tags: [],
    confidence: 'high',
    warnings: [],
    ...overrides,
  }
}

async function linkedCategories(id: number): Promise<string[]> {
  const { rows } = await pg.query<{ name: string }>(
    `SELECT c.name FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id
     WHERE rc.recipe_id = $1 ORDER BY c.name`,
    [id],
  )
  return rows.map((r) => r.name)
}

async function linkedIngredients(id: number): Promise<string[]> {
  const { rows } = await pg.query<{ name_normalized: string }>(
    `SELECT i.name_normalized FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = $1 ORDER BY i.name_normalized`,
    [id],
  )
  return rows.map((r) => r.name_normalized)
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgres://pglite/test'
  const dir = join(process.cwd(), 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(dir, file), 'utf-8'))
  }
})

beforeEach(async () => {
  await pg.exec('TRUNCATE recipes, ingredients RESTART IDENTITY CASCADE')
})

afterAll(async () => {
  await pg.close()
})

describe('migrations', () => {
  it('seed the category catalogue for every recipe type', async () => {
    const types = new Set((await listCategories()).map((c) => c.type))
    expect(types).toEqual(new Set(['cocina', 'pasteleria', 'bebidas']))
  })
})

describe('saveRecipe', () => {
  it('stores the recipe and returns it by id', async () => {
    const { id } = await saveRecipe(recipe())
    const row = await getRecipeById(id)

    expect(row).toMatchObject({ id, title: 'Tortilla de patatas', confidence: 'high', type: 'cocina' })
    expect(row!.data.ingredients).toHaveLength(2)
    expect(row!.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('links categories and normalised ingredients in the same statement', async () => {
    const { id } = await saveRecipe(recipe())

    expect(await linkedCategories(id)).toEqual(['Primeros'])
    expect(await linkedIngredients(id)).toEqual(['huevo', 'patata'])
  })

  it('only links categories that belong to the recipe type', async () => {
    // "Cremas" exists under both cocina and pasteleria.
    const { id } = await saveRecipe(recipe({ type: 'pasteleria', categories: ['Cremas'] }))

    const { rows } = await pg.query<{ type: string }>(
      `SELECT c.type FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id WHERE rc.recipe_id = $1`,
      [id],
    )
    expect(rows).toEqual([{ type: 'pasteleria' }])
  })

  it('ignores unknown categories and duplicate ingredients', async () => {
    const { id } = await saveRecipe(
      recipe({
        categories: ['No existe'],
        ingredients: [
          { name: 'Huevo', normalized: 'huevo' },
          { name: 'Huevos camperos', normalized: ' Huevo ' },
          { name: 'Sal' },
        ],
      }),
    )

    expect(await linkedCategories(id)).toEqual([])
    expect(await linkedIngredients(id)).toEqual(['huevo'])
  })

  it('reuses ingredient rows across recipes', async () => {
    await saveRecipe(recipe())
    await saveRecipe(recipe({ title: 'Revuelto' }))

    const { rows } = await pg.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM ingredients')
    expect(rows[0].n).toBe(2)
  })
})

describe('updateRecipe', () => {
  it('replaces the document and re-syncs links', async () => {
    const { id } = await saveRecipe(recipe())

    const updated = await updateRecipe(
      id,
      recipe({
        title: 'Tortilla con cebolla',
        categories: ['Primeros', 'Verduras'],
        ingredients: [
          { name: 'Huevos', normalized: 'huevo' },
          { name: 'Cebolla', normalized: 'cebolla' },
        ],
      }),
    )

    expect(updated).toMatchObject({ id, title: 'Tortilla con cebolla' })
    expect(await linkedCategories(id)).toEqual(['Primeros', 'Verduras'])
    expect(await linkedIngredients(id)).toEqual(['cebolla', 'huevo'])
  })

  it('returns null for a recipe that does not exist', async () => {
    expect(await updateRecipe(999, recipe())).toBeNull()
  })
})

describe('deleteRecipe', () => {
  it('removes the recipe and cascades its links', async () => {
    const { id } = await saveRecipe(recipe())

    expect(await deleteRecipe(id)).toBe(true)
    expect(await getRecipeById(id)).toBeNull()
    expect(await linkedIngredients(id)).toEqual([])
    expect(await deleteRecipe(id)).toBe(false)
  })
})

describe('getRecipeById', () => {
  it('treats malformed ids as not found instead of querying', async () => {
    expect(await getRecipeById(NaN)).toBeNull()
    expect(await getRecipeById(-1)).toBeNull()
    expect(await getRecipeById(1.5)).toBeNull()
  })
})

describe('listRecipes', () => {
  beforeEach(async () => {
    await saveRecipe(recipe({ imageUrl: 'https://res.cloudinary.com/demo/tortilla.jpg', nutrition: { calories: 152 } }))
    await saveRecipe(
      recipe({
        title: 'Bizcocho de yogur',
        type: 'pasteleria',
        categories: ['Bizcochos'],
        totalTime: '50 min',
        ingredients: [
          { name: 'Huevos', normalized: 'huevo' },
          { name: 'Harina', normalized: 'harina' },
          { name: 'Yogur', normalized: 'yogur' },
        ],
      }),
    )
  })

  it('returns lightweight summaries with a total count', async () => {
    const { recipes, total } = await listRecipes()

    expect(total).toBe(2)
    expect(recipes).toHaveLength(2)
    expect(recipes.find((r) => r.title === 'Tortilla de patatas')).toMatchObject({
      type: 'cocina',
      image_url: 'https://res.cloudinary.com/demo/tortilla.jpg',
      calories: 152,
      ingredient_count: 2,
      step_count: 1,
    })
    expect(recipes.find((r) => r.title === 'Bizcocho de yogur')).toMatchObject({
      total_time: '50 min',
      image_url: null,
      calories: null,
      ingredient_count: 3,
    })
    expect(recipes[0]).not.toHaveProperty('data')
  })

  it('filters by type', async () => {
    const { recipes, total } = await listRecipes(20, 0, { type: 'pasteleria' })
    expect(total).toBe(1)
    expect(recipes[0].title).toBe('Bizcocho de yogur')
  })

  it('filters by category (any of)', async () => {
    const { recipes } = await listRecipes(20, 0, { categories: ['Bizcochos', 'Tarta'] })
    expect(recipes.map((r) => r.title)).toEqual(['Bizcocho de yogur'])
  })

  it('filters by ingredients (all of)', async () => {
    expect((await listRecipes(20, 0, { ingredients: ['huevo'] })).total).toBe(2)
    expect((await listRecipes(20, 0, { ingredients: ['huevo', 'harina'] })).total).toBe(1)
    expect((await listRecipes(20, 0, { ingredients: ['huevo', 'chocolate'] })).total).toBe(0)
  })

  it('searches titles case-insensitively and treats wildcards literally', async () => {
    expect((await listRecipes(20, 0, { query: 'BIZCOCHO' })).total).toBe(1)
    expect((await listRecipes(20, 0, { query: '%' })).total).toBe(0)
    expect((await listRecipes(20, 0, { query: '_' })).total).toBe(0)
  })

  it('combines filters', async () => {
    const { total } = await listRecipes(20, 0, { type: 'cocina', query: 'tortilla', ingredients: ['patata'] })
    expect(total).toBe(1)
  })

  it('paginates while reporting the full total', async () => {
    const page1 = await listRecipes(1, 0)
    const page2 = await listRecipes(1, 1)

    expect(page1.total).toBe(2)
    expect(page1.recipes).toHaveLength(1)
    expect(page2.recipes).toHaveLength(1)
    expect(page1.recipes[0].id).not.toBe(page2.recipes[0].id)
  })
})

describe('listIngredients', () => {
  it('only suggests ingredients still used by a recipe', async () => {
    const { id } = await saveRecipe(recipe())
    await saveRecipe(recipe({ title: 'Flan', ingredients: [{ name: 'Leche', normalized: 'leche' }] }))
    await deleteRecipe(id)

    expect(await listIngredients()).toEqual(['leche'])
  })

  it('filters by a search term', async () => {
    await saveRecipe(recipe())
    expect(await listIngredients('pat')).toEqual(['patata'])
    expect(await listIngredients('%')).toEqual([])
  })
})
