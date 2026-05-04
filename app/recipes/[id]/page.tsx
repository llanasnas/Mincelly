export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeDetail } from "@/components/RecipeDetail";
import { getRecipeById } from "@/lib/db";
import { DeleteRecipeButton } from "./DeleteRecipeButton";
import { DownloadPDFButton } from "@/components/DownloadPDFButton";

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RecipePageProps) {
  const { id } = await params;
  const row = await getRecipeById(parseInt(id, 10));
  if (!row) return {};
  return {
    title: `${row.title} — Mincely`,
    description: row.data.description ?? `Receta: ${row.title}`,
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;
  const row = await getRecipeById(parseInt(id, 10));
  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="lg"
          className="text-base gap-2 cursor-pointer"
        >
          <Link href="/">
            <ArrowLeft className="size-5" aria-hidden="true" />
            Volver
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <DownloadPDFButton recipe={row.data} />
          <Button
            asChild
            variant="outline"
            size="default"
            className="gap-2 cursor-pointer"
          >
            <Link href={`/recipes/${row.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
              Editar
            </Link>
          </Button>
          <DeleteRecipeButton id={row.id} />
        </div>
      </div>

      <RecipeDetail recipe={row.data} />
    </main>
  );
}
