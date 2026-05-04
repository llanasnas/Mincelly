"use client";

import type { Recipe } from "@/lib/schema";
import { cn } from "@/lib/utils";

const CONFIG = {
  high: {
    label: "Alta confianza",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  },
  medium: {
    label: "Confianza media",
    className:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  low: {
    label: "Baja confianza",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
} satisfies Record<Recipe["confidence"], { label: string; className: string }>;

interface ConfidenceBadgeProps {
  confidence: Recipe["confidence"];
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  className,
}: ConfidenceBadgeProps) {
  const { label, className: variantClass } = CONFIG[confidence];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
        variantClass,
        className,
      )}
      aria-label={`Nivel de confianza: ${label}`}
    >
      {label}
    </span>
  );
}
