import { NextRequest, NextResponse } from 'next/server'
import { listCategories, listIngredients } from '@/lib/db'
import { errorResponse } from '@/lib/api'
import { publicMessage } from '@/lib/errors'

/**
 * GET /api/categories
 * Returns all categories grouped by type.
 *
 * GET /api/categories?ingredients=1
 * Also returns the ingredients list.
 *
 * GET /api/categories?ingredientSearch=tom
 * Returns ingredients matching the search term.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const withIngredients = sp.get('ingredients') === '1'
  // Cap search length to prevent excessively large DB queries
  const ingredientSearch = sp.get('ingredientSearch')?.slice(0, 100) || undefined

  try {
    const categories = await listCategories()

    const grouped: Record<string, { id: number; name: string }[]> = {}
    for (const { id, name, type } of categories) {
      (grouped[type] ??= []).push({ id, name })
    }

    if (withIngredients || ingredientSearch) {
      const ingredients = await listIngredients(ingredientSearch)
      return NextResponse.json({ categories: grouped, ingredients })
    }

    return NextResponse.json({ categories: grouped })
  } catch (err) {
    console.error('[categories] list failed', err)
    return errorResponse('DATABASE_ERROR', publicMessage(err, 'Error de base de datos.'), 500)
  }
}
