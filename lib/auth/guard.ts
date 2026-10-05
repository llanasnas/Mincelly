import { cookies } from "next/headers"
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session"
import { isEmailAllowed } from "./config"

/**
 * The signed-in user for the current request, or null.
 * Route protection itself lives in proxy.ts; this is for rendering (navbar,
 * login page) and re-checks the allowlist so a removed email loses access
 * without waiting for the session to expire.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return null
  if (!isEmailAllowed(user.email)) return null
  return user
}
