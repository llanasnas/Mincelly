"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
        <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Algo ha fallado</h1>
        <p className="text-muted-foreground">
          No se pudo cargar esta página. Suele ser un problema pasajero de
          conexión con la base de datos.
        </p>
        {error.digest && (
          <p className="text-sm text-muted-foreground">
            Código de error: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
      <Button size="lg" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
