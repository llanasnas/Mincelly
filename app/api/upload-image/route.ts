export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { uploadImage } from '@/lib/cloudinary'
import { publicMessage } from '@/lib/errors'

const MAX_SIZE_MB = 10
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type}. Use JPEG, PNG, WebP or GIF.` },
      { status: 415 }
    )
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_SIZE_MB} MB.` },
      { status: 413 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadImage(buffer, file.name)
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: publicMessage(err, 'Upload failed') }, { status: 500 })
  }
}
