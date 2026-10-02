import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadForm } from "@/components/UploadForm";

export const metadata: Metadata = {
  title: "Nueva receta",
  description: "Importa una receta desde texto, documento, imagen o YouTube",
};

export default function NewRecipePage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pt-4 sm:pt-8">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="lg" className="-ml-3">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Recetas
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold">Nueva receta</h1>
        <p className="text-muted-foreground">
          Pega el texto, sube una foto o un documento, o indica un vídeo de
          YouTube. La IA la ordena y tú la revisas antes de guardar.
        </p>
      </header>

      <UploadForm />
    </main>
  );
}
