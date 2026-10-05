export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeDetail } from "@/components/RecipeDetail";
import { getRecipeById, parseRecipeId } from "@/lib/db";
import { DeleteRecipeButton } from "./DeleteRecipeButton";
import { DownloadPDFButton } from "@/components/DownloadPDFButton";

interface RecipePageProps {
  params: Promise<{ id: string }>;
}

// cache() dedupes the query between generateMetadata and the page render.
const loadRecipe = cache(async (rawId: string) => {
  const id = parseRecipeId(rawId);
  return id === null ? null : getRecipeById(id);
});

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const row = await loadRecipe((await params).id);
  if (!row) return { title: "Receta no encontrada" };
  return {
    title: row.title,
    description: row.data.description ?? `Receta: ${row.title}`,
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const row = await loadRecipe((await params).id);
  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-4 pb-16 sm:pt-8">
      {/* Toolbar: labels collapse to icons on phones so all four actions fit one row. */}
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="lg" className="-ml-3">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Recetas
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <DownloadPDFButton recipe={row.data} />
          <Button asChild variant="outline" size="lg" className="max-sm:size-11 max-sm:px-0">
            <Link href={`/recipes/${row.id}/edit`}>
              <Pencil aria-hidden="true" />
              <span className="max-sm:sr-only">Editar</span>
            </Link>
          </Button>
          <DeleteRecipeButton id={row.id} />
        </div>
      </div>

      <RecipeDetail recipe={row.data} />
    </main>
  );
}
