import { getAuthSecret } from "./config"

export const SESSION_COOKIE = "mincely_session"
export const OAUTH_STATE_COOKIE = "mincely_oauth_state"
export const ACCESS_DENIED_COOKIE = "mincely_access_denied"

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

export interface SessionUser {
  email: string
  name: string
  picture: string
}

interface SessionPayload extends SessionUser {
  iat: number
  exp: number
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4))
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function signSession(user: SessionUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    ...user,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  }
  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await importKey(getAuthSecret())
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64)),
  )
  return `${payloadB64}.${b64urlEncode(sig)}`
}

export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  const dot = token.indexOf(".")
  if (dot <= 0) return null
  const payloadB64 = token.slice(0, dot)
  const sigB64 = token.slice(dot + 1)

  let key: CryptoKey
  try {
    key = await importKey(getAuthSecret())
  } catch {
    return null
  }

  let sigBytes: Uint8Array
  try {
    sigBytes = b64urlDecode(sigB64)
  } catch {
    return null
  }

  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64)),
  )
  if (!timingSafeEqual(sigBytes, expected)) return null

  let parsed: SessionPayload
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)))
  } catch {
    return null
  }

  if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
    return null
  }
  if (!parsed.email) return null

  return { email: parsed.email, name: parsed.name ?? "", picture: parsed.picture ?? "" }
}

export function sessionCookieAttributes(maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`
}
