"use client";

import { useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { scaleQuantity } from "@/lib/nutrition/parser";
import type { Ingredient } from "@/lib/schema";
import { cn } from "@/lib/utils";

const MAX_SERVINGS = 500;

const stepperButton =
  "flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface IngredientListProps {
  ingredients: Ingredient[];
  /** Servings the recipe was written for. Without it there is nothing to scale against. */
  servings?: number;
}

/**
 * The ingredient list as used while cooking: quantities rescale to the number of
 * servings you are making, and each line can be ticked off once it is in the bowl.
 */
export function IngredientList({ ingredients, servings }: IngredientListProps) {
  const [target, setTarget] = useState(servings ?? 1);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  const factor = servings ? target / servings : 1;

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {servings && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div
            role="group"
            aria-label="Raciones"
            className="inline-flex items-center rounded-xl border border-border bg-card p-0.5"
          >
            <button
              type="button"
              onClick={() => setTarget((n) => Math.max(1, n - 1))}
              disabled={target <= 1}
              aria-label="Una ración menos"
              className={stepperButton}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <output
              aria-live="polite"
              className="min-w-24 px-1 text-center text-base font-bold tabular-nums"
            >
              {target} {target === 1 ? "ración" : "raciones"}
            </output>
            <button
              type="button"
              onClick={() => setTarget((n) => Math.min(MAX_SERVINGS, n + 1))}
              disabled={target >= MAX_SERVINGS}
              aria-label="Una ración más"
              className={stepperButton}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>

          {target !== servings && (
            <button
              type="button"
              onClick={() => setTarget(servings)}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Volver a {servings}
            </button>
          )}
        </div>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {ingredients.map((ing, i) => {
          const done = checked.has(i);
          const amount = [ing.quantity && scaleQuantity(ing.quantity, factor), ing.unit]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={i}>
              <label className="flex min-h-12 cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(i)}
                  className="mt-1 size-5 shrink-0 cursor-pointer rounded"
                />
                <span className={cn("text-lg leading-snug", done && "text-muted-foreground line-through")}>
                  {amount && <span className="font-bold tabular-nums">{amount} </span>}
                  {ing.name}
                  {ing.notes && (
                    <span className="text-base text-muted-foreground"> ({ing.notes})</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
