"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { NutritionTable } from "@/components/NutritionTable";
import {
  CATEGORIES_BY_TYPE,
  RECIPE_TYPES,
  RECIPE_TYPE_LABELS,
} from "@/lib/categories";
import { downscaleImage } from "@/lib/image-resize";
import type { Recipe, Ingredient, Step, Nutrition, NutritionMeta } from "@/lib/schema";
import { cn } from "@/lib/utils";

interface RecipePreviewProps {
  recipe: Recipe;
  onConfirm: (edited: Recipe) => void;
  onCancel: () => void;
  isSaving: boolean;
  cancelLabel?: string;
  /** LLM provider to use when recalculating nutrition. */
  provider?: string;
  /** True when the recipe has never been saved, so leaving the page loses it. */
  unsaved?: boolean;
}

const MAX_CATEGORIES = 3;

const inputCls =
  "w-full min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-10 sm:text-sm";
const labelCls = "mb-1 block text-sm font-medium text-muted-foreground";
const sectionTitle = "text-lg font-bold";
const iconButton =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const chipCls =
  "min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors cursor-pointer sm:min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const addButton =
  "mt-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-base font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** What the nutrition values depend on — if it changes, they are out of date. */
function nutritionBasis(recipe: Recipe): string {
  return JSON.stringify([
    recipe.servings,
    recipe.ingredients.map((i) => [i.name, i.quantity, i.unit]),
  ]);
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function IngredientRow({
  ing,
  position,
  onChange,
  onRemove,
}: {
  ing: Ingredient;
  position: number;
  onChange: (updated: Ingredient) => void;
  onRemove: () => void;
}) {
  // The weight and English name were derived from the original text: once the
  // user edits what they describe, they are stale and must be worked out again.
  const setAmount = (patch: Partial<Ingredient>) => onChange({ ...ing, ...patch, grams: undefined });
  const setName = (name: string) =>
    onChange({
      ...ing,
      name,
      normalized: name.trim().toLowerCase() || undefined,
      nameEn: undefined,
      grams: undefined,
    });

  return (
    // One set of inputs for every screen size. On phones: quantity, unit and the
    // delete button share the first row, name and notes take a full row each.
    <li className="grid grid-cols-[5rem_minmax(0,1fr)_2.75rem] items-center gap-2 py-3 sm:grid-cols-[1.5rem_5rem_6.5rem_minmax(0,1.3fr)_minmax(0,1fr)_2.75rem] sm:py-2">
      <span className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
        {position}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={ing.quantity ?? ""}
        onChange={(e) => setAmount({ quantity: e.target.value || undefined })}
        placeholder="Cant."
        aria-label={`Cantidad del ingrediente ${position}`}
        className={cn(inputCls, "text-center tabular-nums")}
      />
      <input
        type="text"
        value={ing.unit ?? ""}
        onChange={(e) => setAmount({ unit: e.target.value || undefined })}
        placeholder="Unidad"
        aria-label={`Unidad del ingrediente ${position}`}
        autoCapitalize="none"
        className={inputCls}
      />
      <input
        type="text"
        value={ing.name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ingrediente"
        aria-label={`Nombre del ingrediente ${position}`}
        className={cn(inputCls, "order-4 col-span-3 font-medium sm:order-none sm:col-span-1")}
      />
      <input
        type="text"
        value={ing.notes ?? ""}
        onChange={(e) => onChange({ ...ing, notes: e.target.value || undefined })}
        placeholder="Notas (opcional)"
        aria-label={`Notas del ingrediente ${position}`}
        className={cn(inputCls, "order-5 col-span-3 sm:order-none sm:col-span-1")}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Eliminar ingrediente ${position}${ing.name ? `: ${ing.name}` : ""}`}
        className={cn(iconButton, "order-3 sm:order-none")}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function StepRow({
  step,
  onChange,
  onRemove,
}: {
  step: Step;
  onChange: (updated: Step) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className="mt-1.5 flex size-8 flex-none items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground tabular-nums"
        aria-hidden="true"
      >
        {step.order}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <textarea
          value={step.instruction}
          onChange={(e) => onChange({ ...step, instruction: e.target.value })}
          placeholder="Qué hay que hacer en este paso…"
          aria-label={`Instrucción del paso ${step.order}`}
          rows={3}
          className={cn(inputCls, "resize-y leading-relaxed")}
        />
        <input
          type="text"
          value={step.duration ?? ""}
          onChange={(e) => onChange({ ...step, duration: e.target.value || undefined })}
          placeholder="Duración (p. ej. 10 min)"
          aria-label={`Duración del paso ${step.order}`}
          className={cn(inputCls, "sm:max-w-56")}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Eliminar paso ${step.order}`}
        className={iconButton}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export function RecipePreview({
  recipe,
  onConfirm,
  onCancel,
  isSaving,
  cancelLabel = "Cancelar",
  provider,
  unsaved = false,
}: RecipePreviewProps) {
  const [edited, setEdited] = useState<Recipe>(() => ({
    ...recipe,
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
    steps: recipe.steps.map((s) => ({ ...s })),
  }));
  const [dirty, setDirty] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [computedBasis, setComputedBasis] = useState(() => nutritionBasis(recipe));
  const imageInputRef = useRef<HTMLInputElement>(null);

  const update = (updater: (prev: Recipe) => Recipe) => {
    setEdited(updater);
    setDirty(true);
  };
  const setField =
    <K extends keyof Recipe>(key: K) =>
    (value: Recipe[K]) =>
      update((prev) => ({ ...prev, [key]: value }));

  // Warn before a reload / tab close throws away work that exists nowhere else.
  const shouldWarn = (unsaved || dirty) && !isSaving;
  useEffect(() => {
    if (!shouldWarn) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [shouldWarn]);

  async function handleImageSelect(file: File) {
    setImageError(null);
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", await downscaleImage(file));
      const res = await fetch("/api/upload-image", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        setImageError(data?.error ?? "No se pudo subir la imagen.");
        return;
      }
      const url = data.url;
      update((prev) => ({ ...prev, imageUrl: url }));
    } catch {
      setImageError("Error de red al subir la imagen.");
    } finally {
      setImageUploading(false);
    }
  }

  async function recalculateNutrition() {
    setRecalculating(true);
    const basis = nutritionBasis(edited);
    try {
      const query = provider ? `?provider=${encodeURIComponent(provider)}` : "";
      const res = await fetch(`/api/nutrition${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned(edited)),
      });
      const data = (await res.json().catch(() => null)) as {
        nutrition?: Nutrition;
        nutritionMeta?: NutritionMeta;
        error?: string;
      } | null;
      if (!res.ok || !data?.nutrition) {
        toast.error(data?.error ?? "No se pudieron recalcular los valores nutricionales.");
        return;
      }
      update((prev) => ({ ...prev, nutrition: data.nutrition, nutritionMeta: data.nutritionMeta }));
      setComputedBasis(basis);
      toast.success("Valores nutricionales actualizados.");
    } catch {
      toast.error("Error de red al recalcular.");
    } finally {
      setRecalculating(false);
    }
  }

  const updateIngredient = (idx: number, updated: Ingredient) =>
    update((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => (i === idx ? updated : ing)),
    }));
  const removeIngredient = (idx: number) =>
    update((prev) => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }));
  const addIngredient = () =>
    update((prev) => ({ ...prev, ingredients: [...prev.ingredients, { name: "" }] }));

  const updateStep = (idx: number, updated: Step) =>
    update((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === idx ? updated : s)) }));
  const removeStep = (idx: number) =>
    update((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })),
    }));
  const addStep = () =>
    update((prev) => ({
      ...prev,
      steps: [...prev.steps, { order: prev.steps.length + 1, instruction: "" }],
    }));

  function toggleCategory(category: string) {
    update((prev) => {
      const current = prev.categories ?? [];
      return {
        ...prev,
        categories: current.includes(category)
          ? current.filter((c) => c !== category)
          : [...current, category],
      };
    });
  }

  const namedIngredients = edited.ingredients.filter((i) => i.name.trim()).length;
  const writtenSteps = edited.steps.filter((s) => s.instruction.trim()).length;
  const missing = [
    !edited.title.trim() && "un título",
    namedIngredients === 0 && "al menos un ingrediente",
    writtenSteps === 0 && "al menos un paso",
  ].filter(Boolean);
  const canSave = missing.length === 0;
  const nutritionStale = nutritionBasis(edited) !== computedBasis;
  const categoryCount = edited.categories?.length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-muted-foreground">
          Revisa los datos y corrige lo que haga falta antes de guardar.
        </p>
        <ConfidenceBadge confidence={edited.confidence} />
      </div>

      {edited.warnings.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden="true"
          />
          {/* Each note can be dismissed once it has been checked, so it isn't saved with the recipe. */}
          <ul className="min-w-0 flex-1 divide-y divide-amber-300/60 text-base text-amber-900 dark:divide-amber-800/60 dark:text-amber-100">
            {edited.warnings.map((warning, i) => (
              <li key={`${i}-${warning}`} className="flex items-start gap-2 py-1.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">{warning}</span>
                <button
                  type="button"
                  onClick={() =>
                    update((prev) => ({
                      ...prev,
                      warnings: prev.warnings.filter((_, index) => index !== i),
                    }))
                  }
                  aria-label={`Descartar aviso: ${warning}`}
                  className="-my-1.5 -mr-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-amber-800 transition-colors hover:bg-amber-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/60"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-4" aria-label="Datos generales">
        <Field label="Título">
          {(id) => (
            <input
              id={id}
              type="text"
              value={edited.title}
              onChange={(e) => setField("title")(e.target.value)}
              placeholder="Nombre de la receta"
              className={cn(inputCls, "text-xl font-bold sm:text-xl")}
            />
          )}
        </Field>
        <Field label="Descripción">
          {(id) => (
            <textarea
              id={id}
              value={edited.description ?? ""}
              onChange={(e) => setField("description")(e.target.value || undefined)}
              placeholder="Descripción breve de la receta"
              rows={3}
              className={cn(inputCls, "resize-y")}
            />
          )}
        </Field>
      </section>

      <section aria-labelledby="preview-photo">
        <h2 id="preview-photo" className={cn(sectionTitle, "mb-3")}>
          Foto
        </h2>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageSelect(file);
            e.target.value = "";
          }}
        />
        {edited.imageUrl ? (
          <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-border">
            <Image
              src={edited.imageUrl}
              alt="Foto de la receta"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 384px"
            />
            <button
              type="button"
              onClick={() => {
                update((prev) => ({ ...prev, imageUrl: undefined }));
                setImageError(null);
              }}
              aria-label="Quitar foto"
              className="absolute right-2 top-2 flex size-11 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={imageUploading}
            className="flex w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/40 px-6 py-8 transition-colors duration-150 hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
          >
            {imageUploading ? (
              <>
                <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="text-base text-muted-foreground">Subiendo…</span>
              </>
            ) : (
              <>
                <Camera className="size-7 text-muted-foreground" aria-hidden="true" />
                <span className="text-base font-bold">Añadir foto</span>
                <span className="text-sm text-muted-foreground">Opcional</span>
              </>
            )}
          </button>
        )}
        {imageError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {imageError}
          </p>
        )}
      </section>

      <section aria-labelledby="preview-details">
        <h2 id="preview-details" className={cn(sectionTitle, "mb-3")}>
          Detalles
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Raciones">
            {(id) => (
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                value={edited.servings ?? ""}
                onChange={(e) =>
                  setField("servings")(
                    e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined,
                  )
                }
                placeholder="4"
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Dificultad">
            {(id) => (
              <select
                id={id}
                value={edited.difficulty ?? ""}
                onChange={(e) =>
                  setField("difficulty")((e.target.value as Recipe["difficulty"]) || undefined)
                }
                className={inputCls}
              >
                <option value="">Sin indicar</option>
                <option value="easy">Fácil</option>
                <option value="medium">Media</option>
                <option value="hard">Difícil</option>
              </select>
            )}
          </Field>
          <Field label="Coste estimado (€)">
            {(id) => (
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={edited.estimatedCost ?? ""}
                onChange={(e) =>
                  setField("estimatedCost")(e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="0,00"
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Preparación">
            {(id) => (
              <input
                id={id}
                type="text"
                value={edited.prepTime ?? ""}
                onChange={(e) => setField("prepTime")(e.target.value || undefined)}
                placeholder="15 min"
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Cocción">
            {(id) => (
              <input
                id={id}
                type="text"
                value={edited.cookTime ?? ""}
                onChange={(e) => setField("cookTime")(e.target.value || undefined)}
                placeholder="30 min"
                className={inputCls}
              />
            )}
          </Field>
          <Field label="Tiempo total">
            {(id) => (
              <input
                id={id}
                type="text"
                value={edited.totalTime ?? ""}
                onChange={(e) => setField("totalTime")(e.target.value || undefined)}
                placeholder="45 min"
                className={inputCls}
              />
            )}
          </Field>
        </div>
      </section>

      <section aria-labelledby="preview-classification" className="space-y-4">
        <h2 id="preview-classification" className={sectionTitle}>
          Clasificación
        </h2>
        <div>
          <p id="preview-type" className={labelCls}>
            Tipo
          </p>
          <div role="radiogroup" aria-labelledby="preview-type" className="flex flex-wrap gap-2">
            {RECIPE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={edited.type === type}
                // Categories belong to a type, so changing it starts them over.
                onClick={() =>
                  edited.type !== type && update((prev) => ({ ...prev, type, categories: [] }))
                }
                className={cn(
                  chipCls,
                  edited.type === type
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:border-primary/60",
                )}
              >
                {RECIPE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {edited.type && (
          <div>
            <p id="preview-categories" className={labelCls}>
              Categorías{" "}
              <span className="tabular-nums">
                ({categoryCount}/{MAX_CATEGORIES})
              </span>
            </p>
            <div role="group" aria-labelledby="preview-categories" className="flex flex-wrap gap-2">
              {CATEGORIES_BY_TYPE[edited.type].map((category) => {
                const selected = edited.categories?.includes(category) ?? false;
                const blocked = !selected && categoryCount >= MAX_CATEGORIES;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selected}
                    disabled={blocked}
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      chipCls,
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:border-primary/60",
                      blocked && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="preview-ingredients">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 id="preview-ingredients" className={sectionTitle}>
            Ingredientes
          </h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            {edited.ingredients.length}
          </span>
        </div>
        {edited.ingredients.length > 0 ? (
          <ul className="divide-y divide-border">
            {edited.ingredients.map((ing, idx) => (
              <IngredientRow
                key={idx}
                ing={ing}
                position={idx + 1}
                onChange={(u) => updateIngredient(idx, u)}
                onRemove={() => removeIngredient(idx)}
              />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-base text-muted-foreground">Todavía no hay ingredientes.</p>
        )}
        <button type="button" onClick={addIngredient} className={addButton}>
          <Plus className="size-4" aria-hidden="true" />
          Añadir ingrediente
        </button>
      </section>

      <section aria-labelledby="preview-steps">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 id="preview-steps" className={sectionTitle}>
            Preparación
          </h2>
          <span className="text-sm tabular-nums text-muted-foreground">{edited.steps.length}</span>
        </div>
        {edited.steps.length > 0 ? (
          <ol className="divide-y divide-border">
            {edited.steps.map((step, idx) => (
              <StepRow
                key={idx}
                step={step}
                onChange={(u) => updateStep(idx, u)}
                onRemove={() => removeStep(idx)}
              />
            ))}
          </ol>
        ) : (
          <p className="py-3 text-base text-muted-foreground">Todavía no hay pasos.</p>
        )}
        <button type="button" onClick={addStep} className={addButton}>
          <Plus className="size-4" aria-hidden="true" />
          Añadir paso
        </button>
      </section>

      <section aria-labelledby="preview-nutrition" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="preview-nutrition" className={sectionTitle}>
            Información nutricional
          </h2>
          <Button
            type="button"
            variant={nutritionStale ? "default" : "outline"}
            size="lg"
            onClick={recalculateNutrition}
            disabled={recalculating || namedIngredients === 0}
          >
            <RefreshCw className={cn(recalculating && "animate-spin")} aria-hidden="true" />
            {recalculating ? "Calculando…" : "Recalcular"}
          </Button>
        </div>
        {nutritionStale && edited.nutrition && (
          <p className="text-base text-amber-800 dark:text-amber-200">
            Has cambiado los ingredientes o las raciones: recalcula para actualizar estos valores.
          </p>
        )}
        {edited.nutrition ? (
          <NutritionTable
            nutrition={edited.nutrition}
            meta={edited.nutritionMeta}
            servings={edited.servings}
          />
        ) : (
          <p className="text-base text-muted-foreground">
            Sin valores nutricionales. Indica las cantidades de los ingredientes y pulsa Recalcular.
          </p>
        )}
      </section>

      {/* Always within reach: the form is long, especially on a phone. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-sm pb-safe">
        {!canSave && (
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            Para guardar falta {missing.join(", ")}.
          </p>
        )}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 sm:flex-none sm:px-6"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => onConfirm(cleaned(edited))}
            disabled={isSaving || !canSave}
            className="flex-[2] sm:ml-auto sm:flex-none sm:px-8"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Guardando…
              </>
            ) : (
              <>
                <Check aria-hidden="true" />
                Guardar receta
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Drops the blank rows the editor allows while typing, and renumbers the steps. */
function cleaned(recipe: Recipe): Recipe {
  return {
    ...recipe,
    title: recipe.title.trim(),
    ingredients: recipe.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ ...i, name: i.name.trim() })),
    steps: recipe.steps
      .filter((s) => s.instruction.trim())
      .map((s, i) => ({ ...s, instruction: s.instruction.trim(), order: i + 1 })),
  };
}
