import { NextRequest, NextResponse } from 'next/server'
import { listRecipes, saveRecipe } from '@/lib/db'
import { RecipeSaveSchema } from '@/lib/schema'
import { RECIPE_TYPES } from '@/lib/categories'
import { publicMessage } from '@/lib/errors'

const PAGE_SIZE = 20

/**
 * GET /api/recipes?offset=0&type=cocina&categories=Carnes,Salsas&ingredients=tomate,ajo
 * Returns a paginated, filtered list.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0)

  const rawType = sp.get('type')
  const type = RECIPE_TYPES.includes(rawType as never) ? (rawType as 'cocina' | 'pasteleria') : undefined

  const rawCategories = sp.get('categories')
  const categories = rawCategories ? rawCategories.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 10) : undefined

  const rawIngredients = sp.get('ingredients')
  const ingredients = rawIngredients ? rawIngredients.split(',').map((i) => i.trim().toLowerCase()).filter(Boolean).slice(0, 10) : undefined

  try {
    const recipes = await listRecipes(PAGE_SIZE, offset, { type, categories, ingredients })
    return NextResponse.json({ recipes, offset, limit: PAGE_SIZE })
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err, 'Database error') }, { status: 500 })
  }
}

/**
 * POST /api/recipes
 * Body: Recipe JSON (as returned by POST /api/process).
 * Validates with RecipeSaveSchema — requires non-empty ingredients and steps.
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RecipeSaveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid recipe', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  try {
    const { id } = await saveRecipe(parsed.data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err, 'Database error') }, { status: 500 })
  }
}
