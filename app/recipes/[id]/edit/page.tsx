export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecipeById } from "@/lib/db";
import { RecipeEditForm } from "@/components/RecipeEditForm";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await getRecipeById(parseInt(id, 10));
  if (!row) return {};
  return {
    title: `Editar ${row.title} — Mincely`,
  };
}

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params;
  const row = await getRecipeById(parseInt(id, 10));
  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 space-y-8">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="lg"
          className="text-base gap-2 cursor-pointer"
        >
          <Link href={`/recipes/${row.id}`}>
            <ArrowLeft className="size-5" aria-hidden="true" />
            Volver
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-bold">Editar receta</h1>
      </div>

      <RecipeEditForm recipeId={row.id} initialRecipe={row.data} />
    </main>
  );
}
