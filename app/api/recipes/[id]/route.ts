import { NextRequest, NextResponse } from 'next/server'
import { getRecipeById, deleteRecipe, parseRecipeId, updateRecipe } from '@/lib/db'
import { RecipeSaveSchema } from '@/lib/schema'
import { errorResponse } from '@/lib/api'
import { publicMessage } from '@/lib/errors'

type RouteContext = { params: Promise<{ id: string }> }

const invalidId = () => errorResponse('INVALID_ID', 'Identificador de receta no válido.', 400)
const notFound = () => errorResponse('NOT_FOUND', 'Receta no encontrada.', 404)

/**
 * GET /api/recipes/[id]
 * Returns the recipe row, including the full recipe JSON in `data`.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const id = parseRecipeId((await params).id)
  if (id === null) return invalidId()

  try {
    const row = await getRecipeById(id)
    return row ? NextResponse.json(row) : notFound()
  } catch (err) {
    console.error('[recipes] get failed', err)
    return errorResponse('DATABASE_ERROR', publicMessage(err, 'Error de base de datos.'), 500)
  }
}

/**
 * PUT /api/recipes/[id]
 * Updates an existing recipe. Returns the updated row.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const id = parseRecipeId((await params).id)
  if (id === null) return invalidId()

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
    const updated = await updateRecipe(id, parsed.data)
    return updated ? NextResponse.json(updated) : notFound()
  } catch (err) {
    console.error('[recipes] update failed', err)
    return errorResponse('DATABASE_ERROR', publicMessage(err, 'No se pudieron guardar los cambios.'), 500)
  }
}

/**
 * DELETE /api/recipes/[id]
 * Returns 204 on success, 404 if not found.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const id = parseRecipeId((await params).id)
  if (id === null) return invalidId()

  try {
    const deleted = await deleteRecipe(id)
    return deleted ? new NextResponse(null, { status: 204 }) : notFound()
  } catch (err) {
    console.error('[recipes] delete failed', err)
    return errorResponse('DATABASE_ERROR', publicMessage(err, 'No se pudo eliminar la receta.'), 500)
  }
}
