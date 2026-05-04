export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeFilters } from "@/components/RecipeFilters";
import { listRecipes } from "@/lib/db";
import { RECIPE_TYPES } from "@/lib/categories";
import type { RecipeType } from "@/lib/categories";

const PAGE_SIZE = 20;

interface HomeProps {
  searchParams: Promise<{
    offset?: string;
    type?: string;
    categories?: string;
    ingredients?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const {
    offset: offsetParam,
    type: rawType,
    categories: rawCategories,
    ingredients: rawIngredients,
  } = await searchParams;
  const offset = Math.max(0, parseInt(offsetParam ?? "0", 10) || 0);

  const type = RECIPE_TYPES.includes(rawType as RecipeType)
    ? (rawType as RecipeType)
    : undefined;
  const categories = rawCategories?.split(",").filter(Boolean);
  const ingredients = rawIngredients
    ?.split(",")
    .map((i) => i.toLowerCase())
    .filter(Boolean);

  const recipes = await listRecipes(PAGE_SIZE, offset, {
    type,
    categories,
    ingredients,
  });
  const hasPrev = offset > 0;
  const hasNext = recipes.length === PAGE_SIZE;
  const isFirstPage = offset === 0;

  // Build pagination URLs preserving active filters
  const filterQuery = [
    type && `type=${type}`,
    rawCategories && `categories=${rawCategories}`,
    rawIngredients && `ingredients=${rawIngredients}`,
  ]
    .filter(Boolean)
    .join("&");
  const paginationBase = filterQuery ? `/?${filterQuery}&` : "/?";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Mis recetas
          </h1>
          <p className="text-muted-foreground">
            Todas tus recetas procesadas con IA.
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0 cursor-pointer">
          <Link href="/recipes/new">
            <Plus className="size-5" aria-hidden="true" />
            Nueva receta
          </Link>
        </Button>
      </header>

      {/* Filters + Grid layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="w-full lg:w-72 shrink-0">
          <Suspense>
            <RecipeFilters />
          </Suspense>
        </aside>

        {/* Recipe grid */}
        <div className="flex-1 min-w-0 space-y-6">
          {recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border py-24 gap-6 text-center">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10">
                <BookOpen className="size-10 text-primary" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-semibold">
                  {type || categories?.length || ingredients?.length
                    ? "Sin resultados para estos filtros"
                    : "Sin recetas todavía"}
                </p>
                <p className="text-muted-foreground text-lg">
                  {type || categories?.length || ingredients?.length
                    ? "Prueba a cambiar o limpiar los filtros."
                    : "Importa tu primera receta desde texto, imagen o YouTube."}
                </p>
              </div>
              {!type && !categories?.length && !ingredients?.length && (
                <Button
                  asChild
                  size="lg"
                  className="text-lg cursor-pointer shadow-lg shadow-primary/20"
                >
                  <Link href="/recipes/new">
                    <Plus className="size-5" aria-hidden="true" />
                    Añadir la primera
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              {isFirstPage && (
                <p className="text-base text-muted-foreground font-medium">
                  {recipes.length} receta{recipes.length !== 1 ? "s" : ""}
                  {hasNext ? "+" : ""}
                </p>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {recipes.map((recipe, i) => (
                  <RecipeCard key={recipe.id} recipe={recipe} index={i} />
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {(hasPrev || hasNext) && (
            <nav
              className="flex justify-between items-center pt-6"
              aria-label="Paginación"
            >
              {hasPrev ? (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="text-base cursor-pointer"
                >
                  <Link
                    href={`${paginationBase}offset=${Math.max(0, offset - PAGE_SIZE)}`}
                  >
                    ← Anteriores
                  </Link>
                </Button>
              ) : (
                <div />
              )}
              {hasNext && (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="text-base cursor-pointer"
                >
                  <Link href={`${paginationBase}offset=${offset + PAGE_SIZE}`}>
                    Siguientes →
                  </Link>
                </Button>
              )}
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}
