/**
 * Client-side image downscaling (browser only).
 *
 * Phone cameras produce 4–12 MB photos. Vercel rejects request bodies over
 * 4.5 MB and vision models cap images around 5 MB, so sending the original is
 * the main reason uploads fail on mobile. A recipe photo stays perfectly legible
 * at 2000 px, which usually lands under 1 MB — and uploads much faster on 4G.
 */

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.85
/** Files already this small are sent untouched. */
const SKIP_BELOW_BYTES = 1024 * 1024

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Returns a JPEG no larger than 2000 px on its longest side. Falls back to the
 * original file whenever the browser can't decode or re-encode it — the server
 * then validates it as usual.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  const alreadySmall = file.size <= SKIP_BELOW_BYTES
  const webSafe = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp'
  if (alreadySmall && webSafe) return file

  let bitmap: ImageBitmap
  try {
    // 'from-image' applies the EXIF orientation, so portrait photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // JPEG has no alpha channel: paint white first so transparent PNGs don't turn black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await canvasToBlob(canvas, JPEG_QUALITY)
    if (!blob || (webSafe && blob.size >= file.size)) return file

    const name = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
