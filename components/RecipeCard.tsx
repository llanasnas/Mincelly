"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, UtensilsCrossed, ListChecks, ChefHat } from "lucide-react";
import type { RecipeRow } from "@/lib/db";

interface RecipeCardProps {
  recipe: Pick<
    RecipeRow,
    "id" | "title" | "confidence" | "created_at" | "image_url" | "type" | "data"
  >;
  index?: number;
}

export function RecipeCard({ recipe, index = 0 }: RecipeCardProps) {
  const date = new Date(recipe.created_at).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const ingredientCount = recipe.data?.ingredients?.length ?? 0;
  const stepCount = recipe.data?.steps?.length ?? 0;
  const imageUrl = recipe.image_url ?? recipe.data?.imageUrl ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.07,
        type: "spring",
        stiffness: 280,
        damping: 22,
      }}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      style={{ willChange: "transform" }}
    >
      <Link
        href={`/recipes/${recipe.id}`}
        className="block group outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
      >
        <article className="h-full cursor-pointer rounded-2xl border border-border bg-card overflow-hidden transition-all duration-250 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={recipe.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                <ChefHat className="size-12 text-primary/30" />
              </div>
            )}
            {recipe.type && (
              <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-background/90 backdrop-blur-sm text-foreground shadow-sm">
                {recipe.type}
              </span>
            )}
          </div>

          <div className="p-4 space-y-3">
            <h3 className="font-display text-lg font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200">
              {recipe.title}
            </h3>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 shrink-0" aria-hidden="true" />
                <time dateTime={recipe.created_at}>{date}</time>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-sm">
                <UtensilsCrossed className="size-4 text-primary/60" aria-hidden="true" />
                <span className="font-medium">{ingredientCount}</span>
                <span className="text-muted-foreground">ingred.</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <ListChecks className="size-4 text-accent/70" aria-hidden="true" />
                <span className="font-medium">{stepCount}</span>
                <span className="text-muted-foreground">pasos</span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
