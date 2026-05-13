const TRUTHY = new Set(["1", "true", "yes", "on"])

export function isForceLogin(): boolean {
  const raw = process.env.FORCE_LOGIN
  return typeof raw === "string" && TRUTHY.has(raw.toLowerCase().trim())
}

export function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS
  if (!raw) return []
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isEmailAllowed(email: string): boolean {
  const allow = getAllowedEmails()
  if (allow.length === 0) return true
  return allow.includes(email.toLowerCase().trim())
}

export function getGoogleClientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID
  if (!v) throw new Error("Missing GOOGLE_CLIENT_ID")
  return v
}

export function getGoogleClientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET
  if (!v) throw new Error("Missing GOOGLE_CLIENT_SECRET")
  return v
}

export function getAuthSecret(): string {
  const v = process.env.AUTH_SECRET
  if (!v || v.length < 32) {
    throw new Error("Missing or short AUTH_SECRET (>=32 chars required)")
  }
  return v
}

export function getAppUrl(req?: Request): string {
  const env = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/$/, "")
  if (req) {
    const u = new URL(req.url)
    return `${u.protocol}//${u.host}`
  }
  return "http://localhost:3000"
}

export function getRedirectUri(req?: Request): string {
  const env = process.env.AUTH_REDIRECT_URL
  if (env) return env
  return `${getAppUrl(req)}/api/auth/callback`
}
