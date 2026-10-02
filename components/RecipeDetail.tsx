import Image from "next/image";
import {
  Clock,
  Users,
  ChefHat,
  AlertTriangle,
  Euro,
  Gauge,
  ExternalLink,
} from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { IngredientList } from "@/components/IngredientList";
import { NutritionTable } from "@/components/NutritionTable";
import { RECIPE_TYPE_LABELS } from "@/lib/categories";
import type { Recipe } from "@/lib/schema";

interface RecipeDetailProps {
  recipe: Recipe;
}

const DIFFICULTY_LABELS = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
} as const;

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

const sectionHeading = "font-display text-2xl font-bold mb-4";

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const labels = [
    recipe.type && RECIPE_TYPE_LABELS[recipe.type],
    ...recipe.categories,
  ].filter(Boolean);
  const hasMeta = !!(
    recipe.prepTime ||
    recipe.cookTime ||
    recipe.totalTime ||
    recipe.servings ||
    recipe.difficulty ||
    recipe.estimatedCost != null
  );

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      {recipe.imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
          <Image
            src={recipe.imageUrl}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      <header className="space-y-4">
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="text-lg leading-relaxed text-muted-foreground">
            {recipe.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground"
            >
              {label}
            </span>
          ))}
          {recipe.cuisine && (
            <span className="inline-flex items-center gap-1.5 px-1 text-sm text-muted-foreground">
              <ChefHat className="size-4" aria-hidden="true" />
              {recipe.cuisine}
            </span>
          )}
          <ConfidenceBadge confidence={recipe.confidence} />
        </div>
      </header>

      {hasMeta && (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {recipe.prepTime && (
          <MetaTile icon={Clock} label="Preparación" value={recipe.prepTime} />
        )}
        {recipe.cookTime && (
          <MetaTile icon={Clock} label="Cocción" value={recipe.cookTime} />
        )}
        {recipe.totalTime && (
          <MetaTile icon={Clock} label="Tiempo total" value={recipe.totalTime} />
        )}
        {recipe.servings && (
          <MetaTile icon={Users} label="Raciones" value={String(recipe.servings)} />
        )}
        {recipe.difficulty && (
          <MetaTile
            icon={Gauge}
            label="Dificultad"
            value={DIFFICULTY_LABELS[recipe.difficulty]}
          />
        )}
        {recipe.estimatedCost != null && (
          <MetaTile
            icon={Euro}
            label="Coste estimado"
            value={euros.format(recipe.estimatedCost)}
            hint={
              recipe.servings
                ? `${euros.format(recipe.estimatedCost / recipe.servings)} por ración`
                : undefined
            }
          />
        )}
      </dl>
      )}

      <section aria-labelledby="ingredients-heading">
        <h2 id="ingredients-heading" className={sectionHeading}>
          Ingredientes
        </h2>
        <IngredientList
          ingredients={recipe.ingredients}
          servings={recipe.servings}
        />
      </section>

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className={sectionHeading}>
          Preparación
        </h2>
        <ol className="space-y-6">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span
                className="flex size-9 flex-none items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground tabular-nums"
                aria-hidden="true"
              >
                {step.order}
              </span>
              <div className="min-w-0 space-y-1 pt-0.5">
                <p className="text-lg leading-relaxed">{step.instruction}</p>
                {step.duration && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {step.duration}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {recipe.nutrition && (
        <section aria-labelledby="nutrition-heading">
          <h2 id="nutrition-heading" className={sectionHeading}>
            Información nutricional
          </h2>
          <NutritionTable
            nutrition={recipe.nutrition}
            meta={recipe.nutritionMeta}
            servings={recipe.servings}
          />
        </section>
      )}

      {(recipe.tags.length > 0 || recipe.sourceUrl) && (
        <footer className="space-y-4">
          {recipe.tags.length > 0 && (
            <ul aria-label="Etiquetas" className="flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Ver la receta original
            </a>
          )}
        </footer>
      )}

      {recipe.warnings.length > 0 && (
        <aside
          aria-labelledby="warnings-heading"
          className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <h2
            id="warnings-heading"
            className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200"
          >
            <AlertTriangle className="size-5" aria-hidden="true" />
            Revisa estos datos
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-base text-amber-900 dark:text-amber-100">
            {recipe.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}

function MetaTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-muted px-4 py-3">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-bold">
        {value}
        {hint && (
          <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
        )}
      </dd>
    </div>
  );
}
