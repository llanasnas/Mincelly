import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session"
import { isForceLogin, isEmailAllowed } from "./config"

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return null
  if (!isEmailAllowed(user.email)) return null
  return user
}

export async function requireApiUser(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  if (!isForceLogin()) {
    const user = await getCurrentUser()
    if (user) return { user }
    return { user: { email: "", name: "", picture: "" } }
  }
  const user = await getCurrentUser()
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Authentication required", errorCode: "UNAUTHORIZED" },
        { status: 401 },
      ),
    }
  }
  return { user }
}
