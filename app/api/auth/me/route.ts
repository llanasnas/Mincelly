import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/guard"
import { isForceLogin } from "@/lib/auth/config"

export const runtime = "nodejs"

export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json({
    user,
    forceLogin: isForceLogin(),
  })
}
