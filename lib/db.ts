import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import type { Recipe } from './schema'
import type { RecipeType } from './categories'

// Lazy singleton — connection is created on first DB call, not at module load.
// This prevents build failures when DATABASE_URL is not set at build time.
let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('[db] DATABASE_URL is not set')
    _sql = neon(url)
  }
  return _sql
}

export type RecipeRow = {
  id: number
  title: string
  data: Recipe
  confidence: Recipe['confidence']
  created_at: string
  image_url: string | null
  type: RecipeType | null
  estimated_cost: number | null
}

export type CategoryRow = {
  id: number
  name: string
  type: RecipeType
}

export async function saveRecipe(recipe: Recipe): Promise<{ id: number }> {
  const sql = getSql()

  const rows = await sql`
    INSERT INTO recipes (title, data, confidence, type, estimated_cost, created_at)
    VALUES (${recipe.title}, ${JSON.stringify(recipe)}, ${recipe.confidence}, ${recipe.type ?? null}, ${recipe.estimatedCost ?? null}, NOW())
    RETURNING id
  `
  const { id } = rows[0] as { id: number }

  // Insert recipe_categories
  if (recipe.categories?.length) {
    for (const catName of recipe.categories) {
      await sql`
        INSERT INTO recipe_categories (recipe_id, category_id)
        SELECT ${id}, c.id FROM categories c
        WHERE c.name = ${catName}
        ON CONFLICT DO NOTHING
      `
    }
  }

  // Upsert normalized ingredients and link to recipe
  const normalizedNames = recipe.ingredients
    .map((i) => i.normalized?.trim().toLowerCase())
    .filter((n): n is string => !!n)

  for (const name of normalizedNames) {
    await sql`
      INSERT INTO ingredients (name_normalized) VALUES (${name})
      ON CONFLICT (name_normalized) DO NOTHING
    `
    await sql`
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id)
      SELECT ${id}, i.id FROM ingredients i WHERE i.name_normalized = ${name}
      ON CONFLICT DO NOTHING
    `
  }

  return { id }
}

export async function getRecipeById(id: number): Promise<RecipeRow | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, title, data, confidence, type, estimated_cost, created_at
    FROM recipes
    WHERE id = ${id}
    LIMIT 1
  `
  return (rows[0] as RecipeRow) ?? null
}

export interface RecipeFilters {
  type?: RecipeType
  categories?: string[]   // OR logic
  ingredients?: string[]  // AND logic (must contain all)
}

export async function listRecipes(
  limit = 20,
  offset = 0,
  filters: RecipeFilters = {},
): Promise<Pick<RecipeRow, 'id' | 'title' | 'confidence' | 'created_at' | 'image_url' | 'type' | 'data'>[]> {
  const sql = getSql()

  const { type, categories, ingredients } = filters
  const hasCategories = categories && categories.length > 0
  const hasIngredients = ingredients && ingredients.length > 0
  const hasFilters = !!type || hasCategories || hasIngredients

  // Fast path: no filters
  if (!hasFilters) {
    const rows = await sql`
      SELECT id, title, confidence, created_at, type, estimated_cost, data
      FROM recipes
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    return rows as Pick<RecipeRow, 'id' | 'title' | 'confidence' | 'created_at' | 'image_url' | 'type' | 'estimated_cost' | 'data'>[]
  }

  // Dynamic query via parameterized function call
  const conditions: string[] = []
  const params: unknown[] = []
  let p = 1

  if (type) {
    conditions.push(`r.type = $${p++}`)
    params.push(type)
  }

  if (hasCategories) {
    conditions.push(`r.id IN (
      SELECT rc.recipe_id
      FROM recipe_categories rc
      JOIN categories c ON c.id = rc.category_id
      WHERE c.name = ANY($${p++})
    )`)
    params.push(categories)
  }

  if (hasIngredients) {
    conditions.push(`r.id IN (
      SELECT ri.recipe_id
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE i.name_normalized = ANY($${p++})
      GROUP BY ri.recipe_id
      HAVING COUNT(DISTINCT i.name_normalized) = $${p++}
    )`)
    params.push(ingredients, ingredients!.length)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const query = `
    SELECT r.id, r.title, r.confidence, r.created_at, r.type, r.data
    FROM recipes r
    ${where}
    ORDER BY r.created_at DESC
    LIMIT $${p++} OFFSET $${p++}
  `

  const rows = await sql.query(query, params)
  return rows as Pick<RecipeRow, 'id' | 'title' | 'confidence' | 'created_at' | 'image_url' | 'type' | 'data'>[]
}

export async function listCategories(): Promise<CategoryRow[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, name, type FROM categories ORDER BY type, name
  `
  return rows as CategoryRow[]
}

export async function listIngredients(search?: string): Promise<string[]> {
  const sql = getSql()
  if (search?.trim()) {
    const pattern = `%${search.trim().toLowerCase()}%`
    const rows = await sql`
      SELECT name_normalized FROM ingredients
      WHERE name_normalized ILIKE ${pattern}
      ORDER BY name_normalized
      LIMIT 50
    `
    return (rows as { name_normalized: string }[]).map((r) => r.name_normalized)
  }
  const rows = await sql`
    SELECT name_normalized FROM ingredients ORDER BY name_normalized LIMIT 200
  `
  return (rows as { name_normalized: string }[]).map((r) => r.name_normalized)
}

export async function updateRecipe(id: number, recipe: Recipe): Promise<RecipeRow | null> {
  const sql = getSql()

  const rows = await sql`
    UPDATE recipes
    SET title = ${recipe.title},
        data  = ${JSON.stringify(recipe)},
        confidence = ${recipe.confidence},
        type = ${recipe.type ?? null},
        estimated_cost = ${recipe.estimatedCost ?? null}
    WHERE id = ${id}
    RETURNING id, title, data, confidence, type, estimated_cost, created_at
  `
  if (!rows.length) return null

  // Replace categories
  await sql`DELETE FROM recipe_categories WHERE recipe_id = ${id}`
  if (recipe.categories?.length) {
    for (const catName of recipe.categories) {
      await sql`
        INSERT INTO recipe_categories (recipe_id, category_id)
        SELECT ${id}, c.id FROM categories c
        WHERE c.name = ${catName}
        ON CONFLICT DO NOTHING
      `
    }
  }

  // Replace normalized ingredients
  await sql`DELETE FROM recipe_ingredients WHERE recipe_id = ${id}`
  const normalizedNames = recipe.ingredients
    .map((i) => i.normalized?.trim().toLowerCase())
    .filter((n): n is string => !!n)

  for (const name of normalizedNames) {
    await sql`
      INSERT INTO ingredients (name_normalized) VALUES (${name})
      ON CONFLICT (name_normalized) DO NOTHING
    `
    await sql`
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id)
      SELECT ${id}, i.id FROM ingredients i WHERE i.name_normalized = ${name}
      ON CONFLICT DO NOTHING
    `
  }

  return rows[0] as RecipeRow
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const sql = getSql()
  const rows = await sql`
    DELETE FROM recipes
    WHERE id = ${id}
    RETURNING id
  `
  return rows.length > 0
}
