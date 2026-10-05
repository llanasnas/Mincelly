import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { RecipeSchema, type Recipe } from './schema'
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
  type: RecipeType | null
  /** ISO 8601 timestamp. */
  created_at: string
}

/** What the recipe list needs — projected in SQL so the full JSONB never leaves the database. */
export type RecipeSummary = {
  id: number
  title: string
  confidence: Recipe['confidence']
  type: RecipeType | null
  created_at: string
  image_url: string | null
  total_time: string | null
  /** kcal per 100 g. */
  calories: number | null
  ingredient_count: number
  step_count: number
}

export type CategoryRow = {
  id: number
  name: string
  type: RecipeType
}

export interface RecipeFilters {
  type?: RecipeType
  /** Free-text search on the title. */
  query?: string
  categories?: string[]   // OR logic
  ingredients?: string[]  // AND logic (must contain all)
}

const RECIPE_COLUMNS = 'id, title, data, confidence, type, created_at'

// The driver hands timestamps back as Date objects; the app works with ISO strings.
function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function toRecipeRow(row: Record<string, unknown>): RecipeRow {
  // Documents saved by older versions can lack fields added since (categories,
  // tags…). Re-validating fills in the schema defaults, so callers always get a
  // complete Recipe; a document that no longer validates is passed through as it is.
  const parsed = RecipeSchema.safeParse(row.data)
  return {
    ...(row as RecipeRow),
    data: parsed.success ? parsed.data : (row.data as Recipe),
    created_at: toIso(row.created_at),
  }
}

function normalizedIngredientNames(recipe: Recipe): string[] {
  const names = recipe.ingredients
    .map((i) => i.normalized?.trim().toLowerCase())
    .filter((n): n is string => !!n)
  return [...new Set(names)]
}

// Keeps a recipe's category and ingredient links in sync with its JSON document.
// Appended to a statement whose `target` CTE yields the recipe row, with
// $4 = type, $6 = category names, $7 = normalised ingredient names.
//
// Everything runs as ONE statement, so a save is atomic and costs a single
// round trip (the previous version issued two queries per ingredient).
// All CTEs share one snapshot, which is why links are diffed — delete what is no
// longer wanted, insert what is missing — rather than wiped and re-inserted.
const SYNC_LINKS = `
  wanted_categories AS (
    SELECT c.id FROM categories c
    WHERE c.name = ANY($6::text[]) AND ($4::text IS NULL OR c.type = $4::text)
  ),
  new_ingredients AS (
    INSERT INTO ingredients (name_normalized)
    SELECT DISTINCT n FROM unnest($7::text[]) AS n
    ON CONFLICT (name_normalized) DO NOTHING
    RETURNING id
  ),
  wanted_ingredients AS (
    SELECT id FROM new_ingredients
    UNION
    SELECT id FROM ingredients WHERE name_normalized = ANY($7::text[])
  ),
  stale_categories AS (
    DELETE FROM recipe_categories rc USING target t
    WHERE rc.recipe_id = t.id AND rc.category_id NOT IN (SELECT id FROM wanted_categories)
  ),
  stale_ingredients AS (
    DELETE FROM recipe_ingredients ri USING target t
    WHERE ri.recipe_id = t.id AND ri.ingredient_id NOT IN (SELECT id FROM wanted_ingredients)
  ),
  linked_categories AS (
    INSERT INTO recipe_categories (recipe_id, category_id)
    SELECT t.id, w.id FROM target t CROSS JOIN wanted_categories w
    ON CONFLICT DO NOTHING
  ),
  linked_ingredients AS (
    INSERT INTO recipe_ingredients (recipe_id, ingredient_id)
    SELECT t.id, w.id FROM target t CROSS JOIN wanted_ingredients w
    ON CONFLICT DO NOTHING
  )
  SELECT ${RECIPE_COLUMNS} FROM target
`

function recipeParams(recipe: Recipe): unknown[] {
  return [
    recipe.title,
    JSON.stringify(recipe),
    recipe.confidence,
    recipe.type ?? null,
    recipe.estimatedCost ?? null,
    recipe.categories ?? [],
    normalizedIngredientNames(recipe),
  ]
}

export async function saveRecipe(recipe: Recipe): Promise<{ id: number }> {
  const rows = await getSql().query(
    `WITH target AS (
       INSERT INTO recipes (title, data, confidence, type, estimated_cost)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       RETURNING ${RECIPE_COLUMNS}
     ),
     ${SYNC_LINKS}`,
    recipeParams(recipe),
  )
  return { id: (rows[0] as { id: number }).id }
}

export async function updateRecipe(id: number, recipe: Recipe): Promise<RecipeRow | null> {
  const rows = await getSql().query(
    `WITH target AS (
       UPDATE recipes
       SET title = $1, data = $2::jsonb, confidence = $3, type = $4, estimated_cost = $5
       WHERE id = $8
       RETURNING ${RECIPE_COLUMNS}
     ),
     ${SYNC_LINKS}`,
    [...recipeParams(recipe), id],
  )
  return rows[0] ? toRecipeRow(rows[0]) : null
}

/** Strict parsing of an id from a URL segment: "12abc" is not recipe 12. */
export function parseRecipeId(raw: string): number | null {
  return /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null
}

export async function getRecipeById(id: number): Promise<RecipeRow | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const rows = await getSql().query(`SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = $1 LIMIT 1`, [id])
  return rows[0] ? toRecipeRow(rows[0]) : null
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const rows = await getSql().query('DELETE FROM recipes WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

/** Escapes LIKE wildcards so user input is matched literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`
}

export async function listRecipes(
  limit = 20,
  offset = 0,
  filters: RecipeFilters = {},
): Promise<{ recipes: RecipeSummary[]; total: number }> {
  const conditions: string[] = []
  const params: unknown[] = []
  const param = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  if (filters.type) conditions.push(`r.type = ${param(filters.type)}`)

  const query = filters.query?.trim()
  if (query) conditions.push(`r.title ILIKE ${param(likePattern(query))}`)

  if (filters.categories?.length) {
    conditions.push(`r.id IN (
      SELECT rc.recipe_id
      FROM recipe_categories rc
      JOIN categories c ON c.id = rc.category_id
      WHERE c.name = ANY(${param(filters.categories)}::text[])
    )`)
  }

  if (filters.ingredients?.length) {
    const names = [...new Set(filters.ingredients)]
    conditions.push(`r.id IN (
      SELECT ri.recipe_id
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE i.name_normalized = ANY(${param(names)}::text[])
      GROUP BY ri.recipe_id
      HAVING COUNT(DISTINCT i.name_normalized) = ${param(names.length)}::int
    )`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const filterParams = [...params]
  const page = `LIMIT ${param(limit)}::int OFFSET ${param(offset)}::int`
  const sql = getSql()

  const [rows, countRows] = await Promise.all([
    sql.query(
      `SELECT r.id, r.title, r.confidence, r.type, r.created_at,
              r.data->>'imageUrl' AS image_url,
              r.data->>'totalTime' AS total_time,
              r.data->'nutrition'->>'calories' AS calories,
              CASE WHEN jsonb_typeof(r.data->'ingredients') = 'array'
                   THEN jsonb_array_length(r.data->'ingredients') ELSE 0 END AS ingredient_count,
              CASE WHEN jsonb_typeof(r.data->'steps') = 'array'
                   THEN jsonb_array_length(r.data->'steps') ELSE 0 END AS step_count
       FROM recipes r
       ${where}
       ORDER BY r.created_at DESC, r.id DESC
       ${page}`,
      params,
    ),
    sql.query(`SELECT COUNT(*)::int AS total FROM recipes r ${where}`, filterParams),
  ])

  const recipes = rows.map((row): RecipeSummary => {
    const calories = Number(row.calories)
    return {
      id: row.id as number,
      title: row.title as string,
      confidence: row.confidence as Recipe['confidence'],
      type: row.type as RecipeType | null,
      created_at: toIso(row.created_at),
      image_url: (row.image_url as string | null) ?? null,
      total_time: (row.total_time as string | null) ?? null,
      calories: row.calories != null && Number.isFinite(calories) ? calories : null,
      ingredient_count: Number(row.ingredient_count),
      step_count: Number(row.step_count),
    }
  })

  return { recipes, total: Number((countRows[0] as { total: number }).total) }
}

export async function listCategories(): Promise<CategoryRow[]> {
  const rows = await getSql().query('SELECT id, name, type FROM categories ORDER BY type, name')
  return rows as CategoryRow[]
}

/** Ingredient names for the filter autocomplete — only those some recipe actually uses. */
export async function listIngredients(search?: string): Promise<string[]> {
  const term = search?.trim().toLowerCase()
  const rows = await getSql().query(
    `SELECT i.name_normalized
     FROM ingredients i
     WHERE EXISTS (SELECT 1 FROM recipe_ingredients ri WHERE ri.ingredient_id = i.id)
       AND ($1::text IS NULL OR i.name_normalized ILIKE $1::text)
     ORDER BY i.name_normalized
     LIMIT $2::int`,
    [term ? likePattern(term) : null, term ? 50 : 200],
  )
  return (rows as { name_normalized: string }[]).map((r) => r.name_normalized)
}
