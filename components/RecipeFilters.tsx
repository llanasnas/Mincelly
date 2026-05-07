"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { X, Search } from "lucide-react";
import { CATEGORIES_BY_TYPE, RECIPE_TYPES } from "@/lib/categories";
import type { RecipeType } from "@/lib/categories";

export function RecipeFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  // Read state from URL
  const activeType = (sp.get("type") as RecipeType | null) ?? undefined;
  const activeCategories =
    sp.get("categories")?.split(",").filter(Boolean) ?? [];
  const activeIngredients =
    sp.get("ingredients")?.split(",").filter(Boolean) ?? [];

  // Ingredient search
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientSuggestions, setIngredientSuggestions] = useState<string[]>(
    [],
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const push = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname],
  );

  function buildParams(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [key, val] of Object.entries(overrides)) {
      if (val) next.set(key, val);
      else next.delete(key);
    }
    next.delete("offset");
    return next;
  }

  function setType(type: RecipeType | undefined) {
    // Clearing type also clears categories (they're type-scoped)
    const next = buildParams({ type, categories: undefined });
    push(next);
  }

  function toggleCategory(cat: string) {
    const current = activeCategories.includes(cat)
      ? activeCategories.filter((c) => c !== cat)
      : [...activeCategories, cat];
    push(buildParams({ categories: current.join(",") || undefined }));
  }

  function addIngredient(name: string) {
    if (!name.trim() || activeIngredients.includes(name.trim())) return;
    const next = [...activeIngredients, name.trim()];
    push(buildParams({ ingredients: next.join(",") }));
    setIngredientSearch("");
    setShowSuggestions(false);
  }

  function removeIngredient(name: string) {
    const next = activeIngredients.filter((i) => i !== name);
    push(buildParams({ ingredients: next.join(",") || undefined }));
  }

  function clearAll() {
    push(new URLSearchParams());
  }

  // Fetch ingredient suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = ingredientSearch.trim() ? 300 : 0;
    debounceRef.current = setTimeout(async () => {
      if (!ingredientSearch.trim()) {
        setIngredientSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/categories?ingredientSearch=${encodeURIComponent(ingredientSearch)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { ingredients?: string[] };
          setIngredientSuggestions(data.ingredients ?? []);
          setShowSuggestions(true);
        }
      } catch {
        // ignore
      }
    }, delay);
  }, [ingredientSearch]);

  // Close suggestions on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const hasFilters =
    !!activeType || activeCategories.length > 0 || activeIngredients.length > 0;
  const categoryOptions = activeType ? CATEGORIES_BY_TYPE[activeType] : [];

  return (
    <div className="sticky top-24  rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-semibold text-foreground">Filtros</span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            <X className="size-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* Type toggle */}
      <div className="mt-3 mb-3">
        <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
          Tipo
        </p>
        <div className="flex gap-2 flex-wrap">
          {RECIPE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(activeType === t ? undefined : t)}
              className={[
                "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 cursor-pointer",
                activeType === t
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                  : "border-border bg-background hover:border-primary/60 hover:bg-secondary/30",
              ].join(" ")}
            >
              {{ cocina: "🍳 Cocina", pasteleria: "🍰 Pastelería", bebidas: "🥤 Bebidas" }[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Categories (only if type selected) */}
      {activeType && categoryOptions.length > 0 && (
        <div className="pt-3">
          <p className="text-xs font-semibold text-foreground mb-3 mt-3 uppercase tracking-wide">
            Categorías
          </p>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((cat) => {
              const active = activeCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm border-2 transition-all duration-200 cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-muted/40 hover:border-primary/60 hover:bg-secondary/30",
                  ].join(" ")}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingredients AND filter */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2 mt-3 uppercase tracking-wide">
          Ingredientes{" "}
          <span className="text-muted-foreground/60 font-normal normal-case">
            (debe contener todos)
          </span>
        </p>

        {/* Selected ingredients */}
        {activeIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {activeIngredients.map((ing) => (
              <span
                key={ing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground font-medium"
              >
                {ing}
                <button
                  type="button"
                  onClick={() => removeIngredient(ing)}
                  aria-label={`Eliminar ${ing}`}
                  className="hover:opacity-70 cursor-pointer p-0.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div ref={searchRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ingredientSearch.trim()) {
                  addIngredient(ingredientSearch.trim());
                }
              }}
              onFocus={() =>
                ingredientSuggestions.length > 0 && setShowSuggestions(true)
              }
              placeholder="Buscar ingrediente…"
              className="w-full rounded-xl border-2 border-input bg-background pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary transition-colors"
            />
          </div>

          {showSuggestions && ingredientSuggestions.length > 0 && (
            <ul className="absolute z-50 top-full mt-2 w-full rounded-xl border-2 border-border bg-popover shadow-xl overflow-hidden">
              {ingredientSuggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addIngredient(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
