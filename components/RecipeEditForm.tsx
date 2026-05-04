"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RecipePreview } from "@/components/RecipePreview";
import type { Recipe } from "@/lib/schema";

interface RecipeEditFormProps {
  recipeId: number;
  initialRecipe: Recipe;
}

export function RecipeEditForm({
  recipeId,
  initialRecipe,
}: RecipeEditFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm(edited: Recipe) {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Error al guardar los cambios");
        return;
      }

      toast.success("Receta actualizada");
      router.push(`/recipes/${recipeId}`);
      router.refresh();
    } catch {
      toast.error("Error de red al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RecipePreview
      recipe={initialRecipe}
      onConfirm={handleConfirm}
      onCancel={() => router.push(`/recipes/${recipeId}`)}
      isSaving={isSaving}
    />
  );
}
