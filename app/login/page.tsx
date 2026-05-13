export const dynamic = "force-dynamic"

import Link from "next/link"
import { redirect } from "next/navigation"
import { ShieldCheck, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth/guard"
import { isForceLogin } from "@/lib/auth/config"

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string; error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Google rechazó la autenticación. Inténtalo de nuevo.",
  bad_state: "Sesión OAuth inválida o expirada. Inténtalo de nuevo.",
  token_exchange: "No se pudo completar el intercambio con Google.",
  userinfo: "No se pudo obtener tu perfil de Google.",
  no_email: "Google no devolvió un email verificado.",
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnTo, error } = await searchParams
  const user = await getCurrentUser()
  if (user) redirect(returnTo && returnTo.startsWith("/") ? returnTo : "/")

  const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/"
  const startUrl = `/api/auth/google?returnTo=${encodeURIComponent(safeReturnTo)}`
  const errorMsg = error ? ERROR_MESSAGES[error] ?? "Error de autenticación." : null

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold">Acceso privado</h1>
          <p className="text-sm text-muted-foreground">
            Esta instancia de Mincely es privada. Inicia sesión con tu cuenta de
            Google autorizada para continuar.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <Button asChild size="lg" className="w-full">
          <a href={startUrl}>
            <LogIn className="size-4" aria-hidden="true" />
            Continuar con Google
          </a>
        </Button>

        {!isForceLogin() && (
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:underline">
              ← Volver al inicio
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
