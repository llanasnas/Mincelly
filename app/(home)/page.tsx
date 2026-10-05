export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { Plus, BookOpen, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeFilters } from "@/components/RecipeFilters";
import { listRecipes } from "@/lib/db";
import { hasActiveFilters, parseRecipeFilters } from "@/lib/recipe-filters";

const PAGE_SIZE = 20;

interface HomeProps {
  searchParams: Promise<{
    offset?: string;
    q?: string;
    type?: string;
    categories?: string;
    ingredients?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const offset = Math.max(0, parseInt(params.offset ?? "0", 10) || 0);
  const filters = parseRecipeFilters(params);
  const filtered = hasActiveFilters(filters);

  const { recipes, total } = await listRecipes(PAGE_SIZE, offset, filters);

  const hasPrev = offset > 0;
  const hasNext = offset + recipes.length < total;

  // Pagination links keep whatever filters are active.
  const pageHref = (nextOffset: number) => {
    const query = new URLSearchParams();
    for (const key of ["q", "type", "categories", "ingredients"] as const) {
      if (params[key]) query.set(key, params[key]);
    }
    if (nextOffset > 0) query.set("offset", String(nextOffset));
    const qs = query.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-6 pb-28 sm:py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Mis recetas
          </h1>
          <p className="text-muted-foreground" aria-live="polite">
            {total === 0
              ? filtered
                ? "Ninguna receta coincide con los filtros."
                : "Todavía no has guardado ninguna receta."
              : `${total} receta${total !== 1 ? "s" : ""}${filtered ? " con estos filtros" : ""}`}
          </p>
        </div>
        {/* On phones the same action lives in the floating button below. */}
        <Button asChild size="lg" className="hidden shrink-0 sm:inline-flex">
          <Link href="/recipes/new">
            <Plus className="size-5" aria-hidden="true" />
            Nueva receta
          </Link>
        </Button>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="w-full shrink-0 lg:w-72">
          <Suspense>
            <RecipeFilters />
          </Suspense>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          {recipes.length === 0 ? (
            <EmptyState filtered={filtered} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
              {recipes.map((recipe, i) => (
                <li key={recipe.id}>
                  <RecipeCard recipe={recipe} priority={i < 3} />
                </li>
              ))}
            </ul>
          )}

          {(hasPrev || hasNext) && (
            <nav
              className="flex items-center justify-between gap-4 pt-2"
              aria-label="Paginación"
            >
              {hasPrev ? (
                <Button asChild variant="outline" size="lg">
                  <Link href={pageHref(Math.max(0, offset - PAGE_SIZE))}>
                    ← Anteriores
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <p className="text-sm text-muted-foreground tabular-nums">
                {offset + 1}–{offset + recipes.length} de {total}
              </p>
              {hasNext ? (
                <Button asChild variant="outline" size="lg">
                  <Link href={pageHref(offset + PAGE_SIZE)}>Siguientes →</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </div>

      {/* Primary action within thumb reach on phones. */}
      <Button
        asChild
        size="lg"
        className="fixed right-4 z-20 h-14 rounded-full px-5 text-base shadow-lg shadow-primary/25 sm:hidden bottom-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <Link href="/recipes/new">
          <Plus className="size-5" aria-hidden="true" />
          Nueva receta
        </Link>
      </Button>
    </main>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  const Icon = filtered ? SearchX : BookOpen;
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border px-6 py-16 text-center sm:py-24">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="size-8 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <p className="text-xl font-bold">
          {filtered ? "Sin resultados" : "Tu recetario está vacío"}
        </p>
        <p className="mx-auto max-w-sm text-muted-foreground">
          {filtered
            ? "Prueba con otra búsqueda o quita algún filtro."
            : "Pega un texto, sube una foto o un documento, o pega el enlace de un vídeo de YouTube: Mincely lo convierte en una receta ordenada."}
        </p>
      </div>
      {filtered ? (
        <Button asChild variant="outline" size="lg">
          <Link href="/">Quitar filtros</Link>
        </Button>
      ) : (
        <Button asChild size="lg">
          <Link href="/recipes/new">
            <Plus className="size-5" aria-hidden="true" />
            Importar la primera receta
          </Link>
        </Button>
      )}
    </div>
  );
}
