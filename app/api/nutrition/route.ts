export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, rateLimited } from '@/lib/api'
import { publicMessage } from '@/lib/errors'
import { getAvailableProviders } from '@/lib/llm/provider'
import { computeNutrition } from '@/lib/nutrition/engine'
import { RecipeSchema } from '@/lib/schema'

const RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }

/**
 * POST /api/nutrition?provider=anthropic
 * Body: Recipe JSON.
 *
 * Recomputes nutrition for a recipe whose ingredients were edited by hand.
 * Returns { nutrition, nutritionMeta }. Does NOT persist anything.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimited(req, 'nutrition', RATE_LIMIT)
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('PARSING_FAILED', 'El cuerpo de la petición no es JSON válido.', 400)
  }

  const parsed = RecipeSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('PARSING_FAILED', 'La receta no tiene un formato válido.', 422)
  }

  const requested = req.nextUrl.searchParams.get('provider')
  const provider = getAvailableProviders().find((p) => p.id === requested)?.id

  try {
    const { nutrition, meta } = await computeNutrition(parsed.data, { provider })
    if (!nutrition) {
      return errorResponse(
        'NUTRITION_UNAVAILABLE',
        'No se pudieron calcular los valores nutricionales. Indica las cantidades de los ingredientes.',
        422,
      )
    }
    return NextResponse.json({ nutrition, nutritionMeta: meta })
  } catch (err) {
    console.error('[nutrition] computation failed', err)
    return errorResponse('NUTRITION_UNAVAILABLE', publicMessage(err, 'No se pudieron calcular los valores nutricionales.'), 500)
  }
}
