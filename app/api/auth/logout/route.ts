import { NextResponse } from "next/server"
import {
  ACCESS_DENIED_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieAttributes,
} from "@/lib/auth/session"
import { getAppUrl } from "@/lib/auth/config"

export const runtime = "nodejs"

function clearCookies(res: NextResponse) {
  for (const name of [SESSION_COOKIE, OAUTH_STATE_COOKIE, ACCESS_DENIED_COOKIE]) {
    res.headers.append("Set-Cookie", `${name}=; ${sessionCookieAttributes(0)}`)
  }
}

export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearCookies(res)
  return res
}

export async function GET(req: Request) {
  const res = NextResponse.redirect(`${getAppUrl(req)}/login`)
  clearCookies(res)
  return res
}
