export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { uploadImage } from '@/lib/cloudinary'
import { detectMediaType } from '@/lib/extractors/image'
import { errorResponse, rateLimited } from '@/lib/api'
import { publicMessage } from '@/lib/errors'

const MAX_SIZE_MB = 10
const RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }

/**
 * POST /api/upload-image
 * multipart/form-data with `file`. Uploads a recipe photo and returns { url }.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimited(req, 'upload-image', RATE_LIMIT)
  if (limited) return limited

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return errorResponse('INVALID_UPLOAD', 'Los datos del formulario no son válidos.', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return errorResponse('INVALID_UPLOAD', 'No se ha enviado ningún archivo.', 400)
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return errorResponse('INVALID_UPLOAD', `La imagen es demasiado grande. El máximo son ${MAX_SIZE_MB} MB.`, 413)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // The declared MIME type is client-controlled — trust the file's magic bytes instead.
  if (!detectMediaType(buffer)) {
    return errorResponse('INVALID_UPLOAD', 'Formato no compatible. Usa JPG, PNG, WebP o GIF.', 415)
  }

  try {
    const url = await uploadImage(buffer, file.name)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[upload-image] upload failed', err)
    return errorResponse('UPLOAD_FAILED', publicMessage(err, 'No se pudo subir la imagen.'), 500)
  }
}
