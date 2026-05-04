import { UploadForm } from "@/components/UploadForm";
import { Toaster } from "@/components/ui/sonner";
import { Sparkles } from "lucide-react";

export const metadata = {
  title: "Nueva receta — Mincely",
  description:
    "Importa una receta desde texto, documento Word, imagen o YouTube",
};

export default function NewRecipePage() {
  return (
    <>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Impulsado por IA
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Nueva receta
          </h1>
          <p className="text-muted-foreground">
            Pega el texto, sube un archivo o indica un vídeo de YouTube.
          </p>
        </header>

        <UploadForm />
      </main>
      <Toaster richColors position="bottom-center" />
    </>
  );
}
