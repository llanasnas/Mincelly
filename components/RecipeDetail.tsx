"use client";

import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { Clock, Users, ChefHat, AlertTriangle, Euro } from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { NutritionTable } from "@/components/NutritionTable";
import type { Recipe } from "@/lib/schema";

interface RecipeDetailProps {
  recipe: Recipe;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.07, ease: "easeOut" },
  }),
};

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  return (
    <article className="max-w-2xl mx-auto space-y-10 pb-16">
      {/* Hero image */}
      {recipe.imageUrl && (
        <motion.div
          className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-lg"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
          />
        </motion.div>
      )}

      {/* Header */}
      <motion.header
        className="space-y-4"
        initial="hidden"
        animate="visible"
        custom={0}
        variants={fadeUp}
      >
        <h1 className="font-display text-4xl font-bold leading-tight text-gradient">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="text-lg text-muted-foreground leading-relaxed">
            {recipe.description}
          </p>
        )}
        <div className="flex flex-wrap gap-3 items-center">
          <ConfidenceBadge confidence={recipe.confidence} />
          {recipe.cuisine && (
            <span className="inline-flex items-center gap-1.5 text-base text-muted-foreground">
              <ChefHat className="size-4" aria-hidden="true" />
              {recipe.cuisine}
            </span>
          )}
        </div>
      </motion.header>

      {/* Meta */}
      {(recipe.prepTime ||
        recipe.cookTime ||
        recipe.totalTime ||
        recipe.servings ||
        recipe.estimatedCost) && (
        <motion.section
          aria-label="Tiempos y raciones"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
        >
          {recipe.prepTime && (
            <MetaTile
              icon={<Clock className="size-5" />}
              label="Preparación"
              value={recipe.prepTime}
            />
          )}
          {recipe.cookTime && (
            <MetaTile
              icon={<Clock className="size-5" />}
              label="Cocción"
              value={recipe.cookTime}
            />
          )}
          {recipe.totalTime && (
            <MetaTile
              icon={<Clock className="size-5" />}
              label="Total"
              value={recipe.totalTime}
            />
          )}
          {recipe.servings && (
            <MetaTile
              icon={<Users className="size-5" />}
              label="Raciones"
              value={String(recipe.servings)}
            />
          )}
          {recipe.estimatedCost != null && (
            <MetaTile
              icon={<Euro className="size-5" />}
              label={
                recipe.servings
                  ? `€/ración (${recipe.servings})`
                  : "Coste estimado"
              }
              value={
                recipe.servings
                  ? `${(recipe.estimatedCost / recipe.servings).toFixed(2)} €`
                  : `${recipe.estimatedCost.toFixed(2)} €`
              }
              subtitle={
                recipe.servings
                  ? `Total: ${recipe.estimatedCost.toFixed(2)} €`
                  : undefined
              }
            />
          )}
        </motion.section>
      )}

      {/* Ingredients */}
      <motion.section
        aria-labelledby="ingredients-heading"
        initial="hidden"
        animate="visible"
        custom={2}
        variants={fadeUp}
      >
        <h2
          id="ingredients-heading"
          className="font-display text-2xl font-bold mb-5 flex items-center gap-3"
        >
          <span
            className="inline-block w-1 h-7 rounded-full bg-gradient-to-b from-primary to-accent"
            aria-hidden="true"
          />
          Ingredientes
        </h2>
        <ul className="space-y-3">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-baseline gap-2 text-lg">
              <span
                className="size-2.5 rounded-full bg-gradient-to-br from-primary to-accent mt-2 shrink-0 shadow-sm shadow-primary/30"
                aria-hidden="true"
              />
              <span>
                {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ")}
                {ing.notes && (
                  <span className="text-muted-foreground text-base">
                    {" "}
                    ({ing.notes})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Steps */}
      <motion.section
        aria-labelledby="steps-heading"
        initial="hidden"
        animate="visible"
        custom={3}
        variants={fadeUp}
      >
        <h2
          id="steps-heading"
          className="font-display text-2xl font-bold mb-5 flex items-center gap-3"
        >
          <span
            className="inline-block w-1 h-7 rounded-full bg-gradient-to-b from-primary to-accent"
            aria-hidden="true"
          />
          Pasos
        </h2>
        <ol className="space-y-6">
          {recipe.steps.map((step) => (
            <li key={step.order} className="flex gap-5">
              <span
                className="flex-none flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white font-bold text-base shadow-sm shadow-primary/30"
                aria-label={`Paso ${step.order}`}
              >
                {step.order}
              </span>
              <div className="space-y-1">
                <p className="text-lg leading-relaxed">{step.instruction}</p>
                {step.duration && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {step.duration}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* Nutrition */}
      {recipe.nutrition && (
        <motion.section
          aria-labelledby="nutrition-heading"
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeUp}
        >
          <h2
            id="nutrition-heading"
            className="font-display text-2xl font-bold mb-5 flex items-center gap-3"
          >
            <span
              className="inline-block w-1 h-7 rounded-full bg-gradient-to-b from-primary to-accent"
              aria-hidden="true"
            />
            Información nutricional
          </h2>
          <NutritionTable nutrition={recipe.nutrition} />
        </motion.section>
      )}

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <motion.section
          aria-label="Etiquetas"
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeUp}
        >
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary text-secondary-foreground px-4 py-1.5 text-base"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.section>
      )}

      {/* Warnings */}
      {recipe.warnings.length > 0 && (
        <motion.aside
          aria-label="Advertencias"
          className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-5 space-y-2"
          initial="hidden"
          animate="visible"
          custom={6}
          variants={fadeUp}
        >
          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-5" aria-hidden="true" />
            Advertencias
          </div>
          <ul className="space-y-1 text-base text-amber-900 dark:text-amber-200">
            {recipe.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </motion.aside>
      )}
    </article>
  );
}

function MetaTile({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl bg-muted p-4 text-center space-y-1">
      <div className="flex justify-center text-primary">{icon}</div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
