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

export function RecipeEditForm({ recipeId, initialRecipe }: RecipeEditFormProps) {
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

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "No se pudieron guardar los cambios.");
        setIsSaving(false);
        return;
      }

      toast.success("Receta actualizada.");
      // isSaving stays true through the navigation so the unsaved-changes guard keeps quiet.
      router.push(`/recipes/${recipeId}`);
      router.refresh();
    } catch {
      toast.error("Error de red al guardar.");
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
