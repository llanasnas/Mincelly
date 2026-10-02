import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getRedirectUri,
  getAppUrl,
  isEmailAllowed,
  safeReturnPath,
} from "@/lib/auth/config"
import {
  ACCESS_DENIED_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieAttributes,
  signSession,
} from "@/lib/auth/session"

export const runtime = "nodejs"

interface TokenResponse {
  access_token?: string
  id_token?: string
  error?: string
  error_description?: string
}

interface UserInfo {
  email?: string
  email_verified?: boolean | string
  name?: string
  picture?: string
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")
  const appUrl = getAppUrl(req)

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`)
  }

  const store = await cookies()
  const expectedNonce = store.get(OAUTH_STATE_COOKIE)?.value
  let nonce: string | undefined
  let returnTo = "/"
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8"),
    ) as { n?: string; r?: string }
    nonce = decoded.n
    returnTo = decoded.r ?? "/"
  } catch {
    return NextResponse.redirect(`${appUrl}/login?error=bad_state`)
  }
  if (!expectedNonce || !nonce || expectedNonce !== nonce) {
    return NextResponse.redirect(`${appUrl}/login?error=bad_state`)
  }

  let tokens: TokenResponse
  try {
    const body = new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getRedirectUri(req),
      grant_type: "authorization_code",
    })
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
    tokens = (await tokenRes.json()) as TokenResponse
    if (!tokenRes.ok || !tokens.access_token) {
      return NextResponse.redirect(`${appUrl}/login?error=token_exchange`)
    }
  } catch {
    return NextResponse.redirect(`${appUrl}/login?error=token_exchange`)
  }

  let info: UserInfo
  try {
    const r = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    )
    if (!r.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=userinfo`)
    }
    info = (await r.json()) as UserInfo
  } catch {
    return NextResponse.redirect(`${appUrl}/login?error=userinfo`)
  }

  const email = info.email?.toLowerCase().trim()
  // Only accept addresses Google has verified — the allowlist is keyed on email.
  const verified = info.email_verified === true || info.email_verified === "true"
  if (!email || !verified) {
    return NextResponse.redirect(`${appUrl}/login?error=no_email`)
  }

  if (!isEmailAllowed(email)) {
    const res = NextResponse.redirect(`${appUrl}/access-denied`)
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; ${sessionCookieAttributes(0)}`,
    )
    res.headers.append(
      "Set-Cookie",
      `${OAUTH_STATE_COOKIE}=; ${sessionCookieAttributes(0)}`,
    )
    res.headers.append(
      "Set-Cookie",
      `${ACCESS_DENIED_COOKIE}=${encodeURIComponent(email)}; ${sessionCookieAttributes(60 * 5)}`,
    )
    return res
  }

  const jwt = await signSession({
    email,
    name: info.name ?? "",
    picture: info.picture ?? "",
  })

  const res = NextResponse.redirect(`${appUrl}${safeReturnPath(returnTo)}`)
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${jwt}; ${sessionCookieAttributes(SESSION_MAX_AGE_SECONDS)}`,
  )
  res.headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_COOKIE}=; ${sessionCookieAttributes(0)}`,
  )
  res.headers.append(
    "Set-Cookie",
    `${ACCESS_DENIED_COOKIE}=; ${sessionCookieAttributes(0)}`,
  )
  return res
}
