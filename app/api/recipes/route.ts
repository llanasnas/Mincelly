import { NextRequest, NextResponse } from 'next/server'
import { listRecipes, saveRecipe } from '@/lib/db'
import { RecipeSaveSchema } from '@/lib/schema'
import { parseRecipeFilters } from '@/lib/recipe-filters'
import { errorResponse } from '@/lib/api'
import { publicMessage } from '@/lib/errors'

const PAGE_SIZE = 20

/**
 * GET /api/recipes?offset=0&q=tortilla&type=cocina&categories=Carnes,Salsas&ingredients=tomate,ajo
 * Returns a paginated, filtered list of recipe summaries.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0)
  const filters = parseRecipeFilters({
    q: sp.get('q'),
    type: sp.get('type'),
    categories: sp.get('categories'),
    ingredients: sp.get('ingredients'),
  })

  try {
    const { recipes, total } = await listRecipes(PAGE_SIZE, offset, filters)
    return NextResponse.json({ recipes, total, offset, limit: PAGE_SIZE })
  } catch (err) {
    console.error('[recipes] list failed', err)
    return errorResponse('DATABASE_ERROR', publicMessage(err, 'Error de base de datos.'), 500)
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
    return errorResponse('INVALID_RECIPE', 'El cuerpo de la petición no es JSON válido.', 400)
  }

  const parsed = RecipeSaveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { errorCode: 'INVALID_RECIPE', error: 'La receta no es válida.', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  try {
    const { id } = await saveRecipe(parsed.data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[recipes] save failed', err)
    return errorResponse('DATABASE_ERROR', publicMessage(err, 'No se pudo guardar la receta.'), 500)
  }
}
