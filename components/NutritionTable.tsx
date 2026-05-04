import type { Nutrition } from "@/lib/schema";

const ROWS: { label: string; key: keyof Nutrition; unit: string }[] = [
  { label: "Calorías", key: "calories", unit: "kcal" },
  { label: "Proteínas", key: "protein", unit: "g" },
  { label: "Grasas", key: "fat", unit: "g" },
  { label: "Grasas saturadas", key: "saturatedFat", unit: "g" },
  { label: "Hidratos", key: "carbohydrates", unit: "g" },
  { label: "Azúcares", key: "sugar", unit: "g" },
  { label: "Fibra", key: "fiber", unit: "g" },
  { label: "Agua", key: "water", unit: "g" },
  { label: "Extracto seco", key: "dryExtract", unit: "g" },
  { label: "Sodio", key: "sodium", unit: "mg" },
];

export function NutritionTable({ nutrition }: { nutrition: Nutrition }) {
  const rows = ROWS.filter((r) => nutrition[r.key] !== undefined);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-muted/40 overflow-hidden">
      <div className="px-4 py-2 text-sm text-muted-foreground border-b bg-muted/60">
        Valores estimados por 100 g
      </div>
      <dl className="divide-y">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex justify-between items-center px-4 py-2.5 text-sm"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium tabular-nums">
              {nutrition[row.key]} {row.unit}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
