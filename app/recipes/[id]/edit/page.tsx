export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecipeById, parseRecipeId } from "@/lib/db";
import { RecipeEditForm } from "@/components/RecipeEditForm";

interface Props {
  params: Promise<{ id: string }>;
}

// cache() dedupes the query between generateMetadata and the page render.
const loadRecipe = cache(async (rawId: string) => {
  const id = parseRecipeId(rawId);
  return id === null ? null : getRecipeById(id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await loadRecipe((await params).id);
  return { title: row ? `Editar ${row.title}` : "Receta no encontrada" };
}

export default async function EditRecipePage({ params }: Props) {
  const row = await loadRecipe((await params).id);
  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pt-4 sm:pt-8">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="lg" className="-ml-3">
          <Link href={`/recipes/${row.id}`}>
            <ArrowLeft aria-hidden="true" />
            Volver a la receta
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold">Editar receta</h1>
      </div>

      <RecipeEditForm recipeId={row.id} initialRecipe={row.data} />
    </main>
  );
}
