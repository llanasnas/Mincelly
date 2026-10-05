import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No encontrado" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <SearchX className="size-8 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">No está aquí</h1>
        <p className="text-muted-foreground">
          Esta receta no existe o se ha eliminado.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/">Ver mis recetas</Link>
      </Button>
    </main>
  );
}
