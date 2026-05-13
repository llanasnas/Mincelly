import { NextResponse } from "next/server"
import {
  getGoogleClientId,
  getRedirectUri,
} from "@/lib/auth/config"
import {
  OAUTH_STATE_COOKIE,
  sessionCookieAttributes,
} from "@/lib/auth/session"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const returnTo = url.searchParams.get("returnTo") || "/"

  let clientId: string
  let redirectUri: string
  try {
    clientId = getGoogleClientId()
    redirectUri = getRedirectUri(req)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth misconfigured" },
      { status: 500 },
    )
  }

  const nonce = crypto.randomUUID()
  const statePayload = JSON.stringify({ n: nonce, r: returnTo })
  const state = Buffer.from(statePayload).toString("base64url")

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  auth.searchParams.set("client_id", clientId)
  auth.searchParams.set("redirect_uri", redirectUri)
  auth.searchParams.set("response_type", "code")
  auth.searchParams.set("scope", "openid email profile")
  auth.searchParams.set("state", state)
  auth.searchParams.set("prompt", "select_account")
  auth.searchParams.set("access_type", "online")

  const res = NextResponse.redirect(auth.toString())
  res.headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_COOKIE}=${nonce}; ${sessionCookieAttributes(60 * 10)}`,
  )
  return res
}
