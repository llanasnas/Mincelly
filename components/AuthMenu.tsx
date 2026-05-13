import Link from "next/link"
import Image from "next/image"
import { LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth/guard"
import { isForceLogin } from "@/lib/auth/config"

export async function AuthMenu() {
  const force = isForceLogin()
  const user = await getCurrentUser()

  if (!user) {
    if (!force) return null
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/login">
          <LogIn className="size-3.5" aria-hidden="true" />
          Iniciar sesión
        </Link>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2 text-sm">
        {user.picture ? (
          <Image
            src={user.picture}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
        )}
        <span
          className="max-w-[12rem] truncate text-muted-foreground"
          title={user.email}
        >
          {user.name || user.email}
        </span>
      </div>
      <Button asChild size="icon-sm" variant="ghost" aria-label="Cerrar sesión">
        <a href="/api/auth/logout">
          <LogOut className="size-4" aria-hidden="true" />
        </a>
      </Button>
    </div>
  )
}
