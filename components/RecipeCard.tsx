import Link from "next/link";
import Image from "next/image";
import { Clock, Flame, UtensilsCrossed, ListChecks } from "lucide-react";
import { RECIPE_TYPE_LABELS } from "@/lib/categories";
import type { RecipeSummary } from "@/lib/db";

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface RecipeCardProps {
  recipe: RecipeSummary;
  /** Set on the first cards so their images load eagerly (they are the LCP candidates). */
  priority?: boolean;
}

export function RecipeCard({ recipe, priority = false }: RecipeCardProps) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="h-full overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow,transform] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-foreground/5 group-active:scale-[0.99]">
        {/* Most recipes have no photo: skip the media block instead of showing a placeholder. */}
        {recipe.image_url && (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
            <Image
              src={recipe.image_url}
              alt=""
              fill
              priority={priority}
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          </div>
        )}

        <div className="space-y-3 p-4">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug transition-colors duration-200 group-hover:text-primary">
            {recipe.title}
          </h3>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <Stat icon={UtensilsCrossed} label="Ingredientes">
              {recipe.ingredient_count} ingr.
            </Stat>
            <Stat icon={ListChecks} label="Pasos">
              {recipe.step_count} {recipe.step_count === 1 ? "paso" : "pasos"}
            </Stat>
            {recipe.total_time && (
              <Stat icon={Clock} label="Tiempo total">
                {recipe.total_time}
              </Stat>
            )}
            {recipe.calories !== null && (
              <Stat icon={Flame} label="Calorías por 100 g">
                {Math.round(recipe.calories)} kcal
              </Stat>
            )}
          </dl>

          <p className="text-xs text-muted-foreground">
            {recipe.type && (
              <>
                <span className="font-bold text-foreground/80">
                  {RECIPE_TYPE_LABELS[recipe.type]}
                </span>
                {" · "}
              </>
            )}
            <time dateTime={recipe.created_at}>
              {DATE_FORMAT.format(new Date(recipe.created_at))}
            </time>
          </p>
        </div>
      </article>
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="sr-only">{label}</dt>
      <Icon className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
