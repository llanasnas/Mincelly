import crypto from 'crypto'

function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.local'
    )
  }
  return { cloudName, apiKey, apiSecret }
}

function signParams(params: Record<string, string>, apiSecret: string): string {
  const str =
    Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&') + apiSecret
  return crypto.createHash('sha1').update(str).digest('hex')
}

export async function uploadImage(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const { cloudName, apiKey, apiSecret } = getConfig()
  const folder = 'mincely'
  const timestamp = String(Math.floor(Date.now() / 1000))

  const paramsToSign: Record<string, string> = { folder, timestamp }
  const signature = signParams(paramsToSign, apiSecret)

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)]), fileName)
  form.append('api_key', apiKey)
  form.append('timestamp', timestamp)
  form.append('folder', folder)
  form.append('signature', signature)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: form }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Cloudinary upload failed (${res.status}): ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`
    )
  }

  const data = await res.json()
  return (data as { secure_url: string }).secure_url
}
