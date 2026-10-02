"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Nutrition, NutritionMeta } from "@/lib/schema";
import { cn } from "@/lib/utils";

interface Row {
  key: keyof Nutrition;
  label: string;
  unit: string;
  /** Sub-row of the one above ("de las cuales saturadas"). */
  nested?: boolean;
}

// Order of the EU nutrition label, plus water / dry extract (useful in pastry).
const ROWS: Row[] = [
  { key: "calories", label: "Energía", unit: "kcal" },
  { key: "fat", label: "Grasas", unit: "g" },
  { key: "saturatedFat", label: "de las cuales saturadas", unit: "g", nested: true },
  { key: "carbohydrates", label: "Hidratos de carbono", unit: "g" },
  { key: "sugar", label: "de los cuales azúcares", unit: "g", nested: true },
  { key: "fiber", label: "Fibra", unit: "g" },
  { key: "protein", label: "Proteínas", unit: "g" },
  { key: "sodium", label: "Sodio", unit: "mg" },
  { key: "water", label: "Agua", unit: "g" },
  { key: "dryExtract", label: "Extracto seco", unit: "g" },
];

const MACROS = [
  { key: "protein", label: "Proteínas", kcalPerGram: 4, color: "bg-chart-3" },
  { key: "carbohydrates", label: "Hidratos", kcalPerGram: 4, color: "bg-chart-2" },
  { key: "fat", label: "Grasas", kcalPerGram: 9, color: "bg-chart-1" },
] as const;

const SOURCE_LABELS = { reference: "USDA", usda: "USDA", llm: "IA" } as const;

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

function formatValue(value: number, unit: string): string {
  const whole = unit === "kcal" || unit === "mg" || value >= 100;
  return `${(whole ? integer : oneDecimal).format(value)} ${unit}`;
}

function sourceLine(meta: NutritionMeta | undefined): string {
  if (!meta) return "Valores aproximados.";
  switch (meta.source) {
    case "usda":
      return "Calculado ingrediente a ingrediente con datos de USDA FoodData Central.";
    case "mixed": {
      // Never round up to "100 %" while part of the dish is still an estimate.
      const percent = Math.min(99, Math.floor(meta.coverage * 100));
      return `Calculado ingrediente a ingrediente: el ${percent} % del peso con datos de USDA FoodData Central y el resto estimado por IA.`;
    }
    case "estimated":
      return "Estimación de IA, sin datos de laboratorio.";
  }
}

interface NutritionTableProps {
  nutrition: Nutrition;
  meta?: NutritionMeta;
  servings?: number;
}

export function NutritionTable({ nutrition, meta, servings }: NutritionTableProps) {
  const groupId = useId();
  const [basis, setBasis] = useState<"100g" | "serving">("100g");

  const rows = ROWS.filter((row) => nutrition[row.key] !== undefined);
  if (rows.length === 0) return null;

  // Per-serving values need the weight of a serving, which only the engine knows.
  const servingWeight =
    meta?.totalWeight && servings ? meta.totalWeight / servings : undefined;
  const factor = basis === "serving" && servingWeight ? servingWeight / 100 : 1;

  const macroKcal = MACROS.map((macro) => ({
    ...macro,
    kcal: (nutrition[macro.key] ?? 0) * macro.kcalPerGram,
  }));
  const macroTotal = macroKcal.reduce((sum, m) => sum + m.kcal, 0);
  const breakdown = meta?.breakdown?.filter((item) => item.grams !== undefined) ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        {servingWeight ? (
          <div
            role="radiogroup"
            aria-label="Base de los valores nutricionales"
            className="inline-flex rounded-lg bg-muted p-0.5"
          >
            {(
              [
                ["100g", "Por 100 g"],
                ["serving", `Por ración (${integer.format(servingWeight)} g)`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={basis === value}
                onClick={() => setBasis(value)}
                className={cn(
                  "min-h-9 rounded-md px-3 text-sm font-medium transition-colors cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  basis === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">Por 100 g</p>
        )}
      </div>

      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-baseline justify-between gap-4 px-4 py-2.5",
              row.key === "calories" ? "text-base font-bold" : "text-sm",
            )}
          >
            <dt className={cn(row.nested && "pl-4 text-muted-foreground")}>{row.label}</dt>
            <dd className="font-medium tabular-nums whitespace-nowrap">
              {formatValue(nutrition[row.key]! * factor, row.unit)}
            </dd>
          </div>
        ))}
      </dl>

      {macroTotal > 0 && (
        <div className="space-y-2 border-t border-border px-4 py-3">
          <p id={`${groupId}-macros`} className="text-xs font-medium text-muted-foreground">
            Reparto de la energía
          </p>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-labelledby={`${groupId}-macros ${groupId}-legend`}
          >
            {macroKcal.map((macro) => (
              <div
                key={macro.key}
                className={macro.color}
                style={{ width: `${(macro.kcal / macroTotal) * 100}%` }}
              />
            ))}
          </div>
          <ul id={`${groupId}-legend`} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {macroKcal.map((macro) => (
              <li key={macro.key} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", macro.color)} aria-hidden="true" />
                {macro.label}{" "}
                <span className="tabular-nums text-muted-foreground">
                  {integer.format((macro.kcal / macroTotal) * 100)} %
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p>{sourceLine(meta)}</p>
        {meta?.notes?.map((note) => <p key={note}>{note}</p>)}

        {breakdown.length > 0 && (
          <details className="group pt-1">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md [&::-webkit-details-marker]:hidden">
              <ChevronRight
                className="size-4 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              Desglose por ingrediente
            </summary>
            <table className="mt-2 w-full text-left">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 font-medium">Ingrediente</th>
                  <th scope="col" className="py-1 px-2 text-right font-medium">Peso</th>
                  <th scope="col" className="py-1 px-2 text-right font-medium">Energía</th>
                  <th scope="col" className="py-1 pl-2 text-right font-medium">Fuente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {breakdown.map((item, i) => (
                  <tr key={`${item.name}-${i}`}>
                    <td className="py-1.5 pr-2" title={item.match}>
                      {item.name}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                      {formatValue(item.grams!, "g")}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                      {item.calories !== undefined ? formatValue(item.calories, "kcal") : "—"}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-muted-foreground">
                      {item.source ? SOURCE_LABELS[item.source] : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2">
              Pesos y energía de los ingredientes en crudo, para la receta completa
              {meta?.totalWeight
                ? ` (${integer.format(meta.totalWeight)} g una vez terminada).`
                : "."}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
