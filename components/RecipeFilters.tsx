"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { X, Search, SlidersHorizontal, Loader2 } from "lucide-react";
import {
  CATEGORIES_BY_TYPE,
  RECIPE_TYPES,
  RECIPE_TYPE_LABELS,
} from "@/lib/categories";
import type { RecipeType } from "@/lib/categories";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

const chipBase =
  "inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors duration-150 cursor-pointer sm:min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const chipOff =
  "border-border bg-background text-foreground hover:border-primary/60 hover:bg-muted";
const chipOn = "border-primary bg-primary text-primary-foreground";

const fieldCls =
  "h-11 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-base placeholder:text-muted-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

const sectionLabel = "mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground";

export function RecipeFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const panelId = useId();
  const listboxId = useId();

  // The URL is the source of truth for every filter.
  const rawType = sp.get("type");
  const activeType = RECIPE_TYPES.includes(rawType as RecipeType)
    ? (rawType as RecipeType)
    : undefined;
  const activeCategories = sp.get("categories")?.split(",").filter(Boolean) ?? [];
  const activeIngredients = sp.get("ingredients")?.split(",").filter(Boolean) ?? [];
  const urlQuery = sp.get("q") ?? "";

  const [query, setQuery] = useState(urlQuery);
  const [panelOpen, setPanelOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [fetchedSuggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const comboboxRef = useRef<HTMLDivElement>(null);
  // Results for a previous term must not linger once the box is cleared.
  const suggestions = ingredientSearch.trim() ? fetchedSuggestions : [];

  function navigate(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("offset"); // any filter change goes back to the first page
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Keep the box in sync when the URL changes from outside (back button, "Quitar
  // filtros") — but not when the change is the echo of our own debounced search,
  // or it would overwrite what the user typed in the meantime.
  const lastSearch = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery === lastSearch.current) return;
    lastSearch.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  // Debounced title search.
  useEffect(() => {
    const term = query.trim();
    if (term === lastSearch.current) return;
    const timer = setTimeout(() => {
      lastSearch.current = term;
      navigate({ q: term || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `navigate` closes over the latest search params; re-running on it would re-fire the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  // Ingredient autocomplete.
  useEffect(() => {
    const term = ingredientSearch.trim();
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/categories?ingredientSearch=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { ingredients?: string[] };
        setSuggestions(data.ingredients ?? []);
        setActiveSuggestion(-1);
        setShowSuggestions(true);
      } catch {
        // Aborted or offline — the field still accepts free text.
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ingredientSearch]);

  // Close suggestions on outside click.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!comboboxRef.current?.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggleCategory(category: string) {
    const next = activeCategories.includes(category)
      ? activeCategories.filter((c) => c !== category)
      : [...activeCategories, category];
    navigate({ categories: next.join(",") || undefined });
  }

  function addIngredient(name: string) {
    const value = name.trim().toLowerCase();
    setIngredientSearch("");
    setShowSuggestions(false);
    if (!value || activeIngredients.includes(value)) return;
    navigate({ ingredients: [...activeIngredients, value].join(",") });
  }

  function removeIngredient(name: string) {
    const next = activeIngredients.filter((i) => i !== name);
    navigate({ ingredients: next.join(",") || undefined });
  }

  function onIngredientKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestion((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      addIngredient(suggestions[activeSuggestion] ?? ingredientSearch);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const panelFilterCount =
    (activeType ? 1 : 0) + activeCategories.length + activeIngredients.length;
  const hasFilters = panelFilterCount > 0 || !!urlQuery;
  const suggestionsOpen = showSuggestions && suggestions.length > 0;

  return (
    <div className="space-y-3 lg:sticky lg:top-20">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar receta…"
            aria-label="Buscar receta por título"
            enterKeyHint="search"
            className={cn(fieldCls, "[&::-webkit-search-cancel-button]:hidden")}
          />
          {isPending ? (
            <Loader2
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Borrar búsqueda"
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )
          )}
        </div>

        {/* On phones the filters stay folded away so the recipes are the first thing on screen. */}
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-controls={panelId}
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors cursor-pointer lg:hidden",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            panelOpen || panelFilterCount > 0
              ? "border-primary text-primary"
              : "border-input text-foreground",
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros
          {panelFilterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums">
              {panelFilterCount}
            </span>
          )}
        </button>
      </div>

      <div
        id={panelId}
        className={cn(
          "space-y-5 rounded-2xl border border-border bg-card p-4 lg:block",
          !panelOpen && "hidden",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Filtros</h2>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                startTransition(() => router.replace(pathname, { scroll: false }));
              }}
              className="-mr-2 flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
              Quitar todos
            </button>
          )}
        </div>

        <section aria-labelledby={`${panelId}-type`}>
          <h3 id={`${panelId}-type`} className={sectionLabel}>
            Tipo
          </h3>
          <div className="flex flex-wrap gap-2">
            {RECIPE_TYPES.map((type) => {
              const active = activeType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  // Categories are scoped to a type, so switching type clears them.
                  onClick={() =>
                    navigate({ type: active ? undefined : type, categories: undefined })
                  }
                  className={cn(chipBase, active ? chipOn : chipOff)}
                >
                  {RECIPE_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </section>

        {activeType && (
          <section aria-labelledby={`${panelId}-categories`}>
            <h3 id={`${panelId}-categories`} className={sectionLabel}>
              Categorías
            </h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES_BY_TYPE[activeType].map((category) => {
                const active = activeCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleCategory(category)}
                    className={cn(chipBase, active ? chipOn : chipOff)}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby={`${panelId}-ingredients`}>
          <h3 id={`${panelId}-ingredients`} className={sectionLabel}>
            Ingredientes{" "}
            <span className="font-normal normal-case tracking-normal">
              (que los lleve todos)
            </span>
          </h3>

          {activeIngredients.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {activeIngredients.map((ingredient) => (
                <li key={ingredient}>
                  <button
                    type="button"
                    onClick={() => removeIngredient(ingredient)}
                    aria-label={`Quitar ${ingredient}`}
                    className={cn(chipBase, chipOn, "gap-1.5")}
                  >
                    {ingredient}
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div ref={comboboxRef} className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              role="combobox"
              aria-label="Añadir ingrediente al filtro"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                activeSuggestion >= 0 ? `${listboxId}-${activeSuggestion}` : undefined
              }
              autoComplete="off"
              autoCapitalize="none"
              enterKeyHint="done"
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              onKeyDown={onIngredientKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Añadir ingrediente…"
              className={cn(fieldCls, "pr-4")}
            />

            <ul
              id={listboxId}
              role="listbox"
              aria-label="Ingredientes sugeridos"
              className={cn(
                "absolute top-full z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg shadow-foreground/10",
                !suggestionsOpen && "hidden",
              )}
            >
              {suggestions.map((suggestion, i) => (
                <li
                  key={suggestion}
                  id={`${listboxId}-${i}`}
                  role="option"
                  aria-selected={i === activeSuggestion}
                  // pointerdown would blur the input before click fires
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => addIngredient(suggestion)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center px-4 text-sm",
                    i === activeSuggestion ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
