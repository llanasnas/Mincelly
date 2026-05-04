import { NextRequest, NextResponse } from 'next/server'
import { getRecipeById, deleteRecipe, updateRecipe } from '@/lib/db'
import { RecipeSaveSchema } from '@/lib/schema'
import { publicMessage } from '@/lib/errors'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/recipes/[id]
 * Returns the full recipe JSON stored in the `data` column.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
    const { id: rawId } = await params
    const id = parseInt(rawId, 10)
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    try {
        const row = await getRecipeById(id)
        if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(row)
    } catch (err) {
        return NextResponse.json({ error: publicMessage(err, 'Database error') }, { status: 500 })
    }
}

/**
 * PUT /api/recipes/[id]
 * Updates an existing recipe. Returns the updated row.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
    const { id: rawId } = await params
    const id = parseInt(rawId, 10)
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = RecipeSaveSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation failed', issues: parsed.error.issues },
            { status: 422 },
        )
    }

    try {
        const updated = await updateRecipe(id, parsed.data)
        if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(updated)
    } catch (err) {
        return NextResponse.json({ error: publicMessage(err, 'Database error') }, { status: 500 })
    }
}

/**
 * DELETE /api/recipes/[id]
 * Returns 204 on success, 404 if not found.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
    const { id: rawId } = await params
    const id = parseInt(rawId, 10)
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    try {
        const deleted = await deleteRecipe(id)
        if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        return NextResponse.json({ error: publicMessage(err, 'Database error') }, { status: 500 })
    }
}
