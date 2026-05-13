import { NextResponse, type NextRequest } from "next/server"
import { isForceLogin, isEmailAllowed } from "@/lib/auth/config"
import {
  SESSION_COOKIE,
  verifySession,
  sessionCookieAttributes,
} from "@/lib/auth/session"

const PROTECTED_PAGE_PREFIXES = ["/recipes"]
const PROTECTED_PAGE_EXACT = new Set(["/"])

const PROTECTED_API_PREFIXES = [
  "/api/process",
  "/api/recipes",
  "/api/upload-image",
  "/api/categories",
]

function isProtectedPath(pathname: string): { protect: boolean; api: boolean } {
  if (pathname.startsWith("/api/auth")) return { protect: false, api: true }
  for (const p of PROTECTED_API_PREFIXES) {
    if (pathname === p || pathname.startsWith(`${p}/`)) {
      return { protect: true, api: true }
    }
  }
  if (pathname.startsWith("/api/")) return { protect: false, api: true }
  for (const p of PROTECTED_PAGE_PREFIXES) {
    if (pathname === p || pathname.startsWith(`${p}/`)) {
      return { protect: true, api: false }
    }
  }
  if (PROTECTED_PAGE_EXACT.has(pathname)) return { protect: true, api: false }
  return { protect: false, api: false }
}

export async function proxy(req: NextRequest) {
  if (!isForceLogin()) return NextResponse.next()

  const { pathname, search } = req.nextUrl
  const { protect, api } = isProtectedPath(pathname)
  if (!protect) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  const allowed = user ? isEmailAllowed(user.email) : false

  if (user && allowed) return NextResponse.next()

  if (api) {
    const res = NextResponse.json(
      { error: "Authentication required", errorCode: "UNAUTHORIZED" },
      { status: 401 },
    )
    if (user && !allowed) {
      res.headers.append(
        "Set-Cookie",
        `${SESSION_COOKIE}=; ${sessionCookieAttributes(0)}`,
      )
    }
    return res
  }

  if (user && !allowed) {
    const res = NextResponse.redirect(new URL("/access-denied", req.url))
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; ${sessionCookieAttributes(0)}`,
    )
    return res
  }

  const loginUrl = new URL("/login", req.url)
  loginUrl.searchParams.set("returnTo", `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/",
    "/recipes/:path*",
    "/api/process/:path*",
    "/api/recipes/:path*",
    "/api/upload-image/:path*",
    "/api/categories/:path*",
  ],
}
