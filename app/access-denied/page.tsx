export const dynamic = "force-dynamic"

import { cookies } from "next/headers"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCESS_DENIED_COOKIE } from "@/lib/auth/session"

export default async function AccessDeniedPage() {
  const store = await cookies()
  const attempted = store.get(ACCESS_DENIED_COOKIE)?.value
  const email = attempted ? decodeURIComponent(attempted) : null

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full rounded-2xl border border-destructive/40 bg-card p-8 shadow-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-7" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold">Acceso denegado</h1>
          <p className="text-sm text-muted-foreground">
            {email ? (
              <>
                La cuenta <strong className="text-foreground">{email}</strong> no
                está autorizada para usar Mincely.
              </>
            ) : (
              <>Tu cuenta de Google no está autorizada para usar Mincely.</>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Si crees que es un error, contacta con el administrador para que
            añada tu email a la lista de autorizados.
          </p>
        </div>

        <Button asChild size="lg" className="w-full" variant="outline">
          <a href="/api/auth/logout">Cerrar sesión y probar con otra cuenta</a>
        </Button>
      </div>
    </main>
  )
}
