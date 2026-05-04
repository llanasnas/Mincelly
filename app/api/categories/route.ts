import { NextRequest, NextResponse } from 'next/server'
import { listCategories, listIngredients } from '@/lib/db'
import { publicMessage } from '@/lib/errors'

/**
 * GET /api/categories
 * Returns all categories grouped by type.
 *
 * GET /api/categories?ingredients=1
 * Also returns the full ingredients list.
 *
 * GET /api/categories?ingredientSearch=tom
 * Returns ingredients matching the search term.
 */
export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams
    const withIngredients = sp.get('ingredients') === '1'
    const rawSearch = sp.get('ingredientSearch') ?? undefined
    // Cap search length to prevent excessively large DB queries
    const ingredientSearch = rawSearch ? rawSearch.slice(0, 100) : undefined

    try {
        const categories = await listCategories()

        const grouped = categories.reduce<Record<string, { id: number; name: string }[]>>(
            (acc, row) => {
                if (!acc[row.type]) acc[row.type] = []
                acc[row.type].push({ id: row.id, name: row.name })
                return acc
            },
            {},
        )

        if (withIngredients || ingredientSearch) {
            const ingredients = await listIngredients(ingredientSearch)
            return NextResponse.json({ categories: grouped, ingredients })
        }

        return NextResponse.json({ categories: grouped })
    } catch (err) {
        return NextResponse.json({ error: publicMessage(err, 'Database error') }, { status: 500 })
    }
}
