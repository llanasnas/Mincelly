"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  ChefHat,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Camera,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { NutritionTable } from "@/components/NutritionTable";
import { CATEGORIES_BY_TYPE, RECIPE_TYPES } from "@/lib/categories";
import type { Recipe, Ingredient, Step } from "@/lib/schema";

interface RecipePreviewProps {
  recipe: Recipe;
  onConfirm: (edited: Recipe) => void;
  onCancel: () => void;
  isSaving: boolean;
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}

function IngredientRow({
  ing,
  idx,
  onChange,
  onRemove,
}: {
  ing: Ingredient;
  idx: number;
  onChange: (updated: Ingredient) => void;
  onRemove: () => void;
}) {
  const set = (key: keyof Ingredient) => (v: string) =>
    onChange({ ...ing, [key]: v || undefined });

  const removeBtn = (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Eliminar ingrediente"
      className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
    >
      <Trash2 className="size-4" />
    </button>
  );

  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      {/* Mobile */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical
              className="size-4 text-muted-foreground/40 shrink-0"
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {idx + 1}.
            </span>
          </div>
          {removeBtn}
        </div>
        <div className="flex gap-2 sm:flex-row flex-col">
          <input
            type="text"
            value={ing.quantity ?? ""}
            onChange={(e) =>
              onChange({ ...ing, quantity: e.target.value || undefined })
            }
            placeholder="Cant."
            aria-label="Cantidad"
            className={`${inputCls} w-20 shrink-0 text-center`}
          />
          <input
            type="text"
            value={ing.unit ?? ""}
            onChange={(e) =>
              onChange({ ...ing, unit: e.target.value || undefined })
            }
            placeholder="Unidad"
            aria-label="Unidad"
            className={`${inputCls} flex-1 min-w-0`}
          />
        </div>
        <input
          type="text"
          value={ing.name}
          onChange={(e) => onChange({ ...ing, name: e.target.value })}
          placeholder="Ingrediente"
          aria-label="Ingrediente"
          className={inputCls}
        />
        <input
          type="text"
          value={ing.notes ?? ""}
          onChange={(e) => set("notes")(e.target.value)}
          placeholder="Notas opcionales"
          aria-label="Notas"
          className={`${inputCls} text-xs`}
        />
      </div>

      {/* Desktop */}
      <div className="hidden sm:grid grid-cols-[auto_auto_5rem_5rem_1fr_1fr_auto] items-center gap-2">
        <GripVertical
          className="size-4 text-muted-foreground/40 shrink-0"
          aria-hidden="true"
        />
        <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">
          {idx + 1}.
        </span>
        <input
          type="text"
          value={ing.quantity ?? ""}
          onChange={(e) =>
            onChange({ ...ing, quantity: e.target.value || undefined })
          }
          placeholder="Cant."
          aria-label="Cantidad"
          className={`${inputCls} text-center`}
        />
        <input
          type="text"
          value={ing.unit ?? ""}
          onChange={(e) =>
            onChange({ ...ing, unit: e.target.value || undefined })
          }
          placeholder="Unidad"
          aria-label="Unidad"
          className={inputCls}
        />
        <input
          type="text"
          value={ing.name}
          onChange={(e) => onChange({ ...ing, name: e.target.value })}
          placeholder="Ingrediente"
          aria-label="Ingrediente"
          className={inputCls}
        />
        <input
          type="text"
          value={ing.notes ?? ""}
          onChange={(e) => set("notes")(e.target.value)}
          placeholder="Notas"
          aria-label="Notas"
          className={inputCls}
        />
        {removeBtn}
      </div>
    </div>
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
    <div className="flex gap-3 items-start py-2 border-b border-border/50 last:border-0">
      <span className="flex-none flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground font-medium text-xs mt-2">
        {step.order}
      </span>
      <div className="flex-1 space-y-1.5">
        <textarea
          value={step.instruction}
          onChange={(e) => onChange({ ...step, instruction: e.target.value })}
          placeholder="Instrucción del paso…"
          rows={2}
          className={`${inputCls} resize-y leading-relaxed`}
        />
        <input
          type="text"
          value={step.duration ?? ""}
          onChange={(e) =>
            onChange({ ...step, duration: e.target.value || undefined })
          }
          placeholder="Duración (ej: 10 min)"
          className={`${inputCls} text-xs`}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar paso"
        className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer mt-2"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function RecipePreview({
  recipe,
  onConfirm,
  onCancel,
  isSaving,
}: RecipePreviewProps) {
  const [edited, setEdited] = useState<Recipe>(() => ({
    ...recipe,
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
    steps: recipe.steps.map((s) => ({ ...s })),
  }));
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function handleImageSelect(file: File) {
    setImageError(null);
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setImageError(data.error ?? "Error al subir la imagen");
        return;
      }
      setEdited((prev) => ({ ...prev, imageUrl: data.url }));
    } catch {
      setImageError("Error de red al subir la imagen");
    } finally {
      setImageUploading(false);
    }
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
    e.target.value = "";
  }

  function removeImage() {
    setEdited((prev) => ({ ...prev, imageUrl: undefined }));
    setImageError(null);
  }

  const setField = useCallback(
    <K extends keyof Recipe>(key: K) =>
      (value: Recipe[K]) =>
        setEdited((prev) => ({ ...prev, [key]: value })),
    [],
  );

  function updateIngredient(idx: number, updated: Ingredient) {
    setEdited((prev) => {
      const next = [...prev.ingredients];
      next[idx] = updated;
      return { ...prev, ingredients: next };
    });
  }

  function removeIngredient(idx: number) {
    setEdited((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  }

  function addIngredient() {
    setEdited((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "" }],
    }));
  }

  function updateStep(idx: number, updated: Step) {
    setEdited((prev) => {
      const next = [...prev.steps];
      next[idx] = updated;
      return { ...prev, steps: next };
    });
  }

  function removeStep(idx: number) {
    setEdited((prev) => {
      const next = prev.steps
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, steps: next };
    });
  }

  function addStep() {
    setEdited((prev) => ({
      ...prev,
      steps: [...prev.steps, { order: prev.steps.length + 1, instruction: "" }],
    }));
  }

  const canSave =
    edited.title.trim().length > 0 &&
    edited.ingredients.length > 0 &&
    edited.steps.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Revisa y edita antes de guardar
          </p>
        </div>
        <ConfidenceBadge confidence={edited.confidence} />
      </div>

      {/* Warnings */}
      {edited.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-4 flex gap-3">
          <AlertTriangle
            className="size-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
            {edited.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Photo */}
      <section>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Foto
        </h3>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={onImageChange}
          aria-label="Seleccionar foto de la receta"
        />
        {edited.imageUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border aspect-video w-full max-w-sm">
            <Image
              src={edited.imageUrl}
              alt="Foto de la receta"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 384px"
            />
            <button
              type="button"
              onClick={removeImage}
              aria-label="Eliminar foto"
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={imageUploading}
            className={[
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed",
              "border-input bg-muted/30 px-6 py-8 w-full max-w-sm cursor-pointer",
              "hover:border-primary/50 hover:bg-primary/5 transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              imageUploading ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {imageUploading ? (
              <>
                <Loader2 className="size-8 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">Subiendo…</span>
              </>
            ) : (
              <>
                <Camera
                  className="size-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">Añadir foto</span>
                <span className="text-xs text-muted-foreground">
                  JPG, PNG, WebP · máx 10 MB
                </span>
              </>
            )}
          </button>
        )}
        {imageError && (
          <p className="mt-2 text-sm text-destructive">{imageError}</p>
        )}
      </section>

      {/* Title + Description */}
      <section className="space-y-3">
        <div>
          <label className={labelCls}>Título</label>
          <input
            type="text"
            value={edited.title}
            onChange={(e) => setField("title")(e.target.value)}
            placeholder="Nombre de la receta"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xl font-bold placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className={labelCls}>Descripción</label>
          <textarea
            value={edited.description ?? ""}
            onChange={(e) =>
              setField("description")(e.target.value || undefined)
            }
            placeholder="Descripción breve de la receta"
            rows={2}
            className={`${inputCls} resize-y`}
          />
        </div>
      </section>

      {/* Meta */}
      <section>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Detalles
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>
              <Users className="inline size-3 mr-1" aria-hidden="true" />
              Raciones
            </label>
            <input
              type="number"
              min={1}
              value={edited.servings ?? ""}
              onChange={(e) =>
                setField("servings")(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="4"
              className={inputCls}
            />
          </div>
          <FieldInput
            label="⏱ Prep."
            value={edited.prepTime ?? ""}
            onChange={(v) => setField("prepTime")(v || undefined)}
            placeholder="15 min"
          />
          <FieldInput
            label="🍳 Cocción"
            value={edited.cookTime ?? ""}
            onChange={(v) => setField("cookTime")(v || undefined)}
            placeholder="30 min"
          />
          <div>
            <label className={labelCls}>
              <ChefHat className="inline size-3 mr-1" aria-hidden="true" />
              Dificultad
            </label>
            <select
              value={edited.difficulty ?? ""}
              onChange={(e) =>
                setField("difficulty")(
                  (e.target.value as Recipe["difficulty"]) || undefined,
                )
              }
              className={inputCls}
            >
              <option value="">—</option>
              <option value="easy">Fácil</option>
              <option value="medium">Media</option>
              <option value="hard">Difícil</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>💶 Coste est. (€)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={edited.estimatedCost ?? ""}
              onChange={(e) =>
                setField("estimatedCost")(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          {edited.estimatedCost != null && edited.servings && (
            <div className="flex flex-col justify-end pb-2">
              <span className="text-xs text-muted-foreground mb-1">
                €/ración
              </span>
              <span className="text-sm font-semibold text-primary">
                {(edited.estimatedCost / edited.servings).toFixed(2)} €
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Classification — type + categories */}
      <section>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Clasificación
        </h3>
        <div className="space-y-4">
          {/* Type */}
          <div>
            <label className={labelCls}>Tipo</label>
            <div className="flex gap-2">
              {RECIPE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setEdited((prev) => ({ ...prev, type: t, categories: [] }))
                  }
                  className={[
                    "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer",
                    edited.type === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input bg-background text-foreground hover:border-primary/60",
                  ].join(" ")}
                >
                  {
                    {
                      cocina: "Cocina",
                      pasteleria: "Pastelería",
                      bebidas: "Bebidas",
                    }[t]
                  }
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          {edited.type && (
            <div>
              <label className={labelCls}>
                Categorías{" "}
                <span className="text-muted-foreground/60">(máx. 3)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {CATEGORIES_BY_TYPE[edited.type].map((cat) => {
                  const selected = edited.categories?.includes(cat) ?? false;
                  const atMax = (edited.categories?.length ?? 0) >= 3;
                  return (
                    <button
                      key={cat}
                      type="button"
                      disabled={!selected && atMax}
                      onClick={() => {
                        setEdited((prev) => {
                          const current = prev.categories ?? [];
                          const next = current.includes(cat)
                            ? current.filter((c) => c !== cat)
                            : [...current, cat];
                          return { ...prev, categories: next };
                        });
                      }}
                      className={[
                        "px-2.5 py-1 rounded-full text-xs border transition-colors cursor-pointer",
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input bg-muted/40 text-foreground hover:border-primary/60",
                        !selected && atMax
                          ? "opacity-40 cursor-not-allowed"
                          : "",
                      ].join(" ")}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              {(edited.categories?.length ?? 0) === 0 && (
                <p className="mt-1.5 text-xs text-destructive">
                  Selecciona al menos una categoría
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Ingredients */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base">Ingredientes</h3>
          <span className="text-xs text-muted-foreground">
            {edited.ingredients.length} ingrediente
            {edited.ingredients.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Column headers — desktop only */}
        <div className="hidden sm:grid grid-cols-[auto_auto_5rem_5rem_1fr_1fr_auto] gap-2 mb-1 px-0.5">
          {["", "#", "Cant.", "Unidad", "Ingrediente", "Notas", ""].map(
            (h, i) => (
              <span
                key={i}
                className="text-xs font-medium text-muted-foreground"
              >
                {h}
              </span>
            ),
          )}
        </div>

        <div className="rounded-lg border border-border bg-card px-3">
          {edited.ingredients.map((ing, idx) => (
            <IngredientRow
              key={idx}
              ing={ing}
              idx={idx}
              onChange={(u) => updateIngredient(idx, u)}
              onRemove={() => removeIngredient(idx)}
            />
          ))}
          {edited.ingredients.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground text-center">
              Sin ingredientes — añade uno.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={addIngredient}
          className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium"
        >
          <Plus className="size-4" />
          Añadir ingrediente
        </button>
      </section>

      {/* Steps */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base">Preparación</h3>
          <span className="text-xs text-muted-foreground">
            {edited.steps.length} paso{edited.steps.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="rounded-lg border border-border bg-card px-3">
          {edited.steps.map((step, idx) => (
            <StepRow
              key={idx}
              step={step}
              onChange={(u) => updateStep(idx, u)}
              onRemove={() => removeStep(idx)}
            />
          ))}
          {edited.steps.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground text-center">
              Sin pasos — añade uno.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={addStep}
          className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium"
        >
          <Plus className="size-4" />
          Añadir paso
        </button>
      </section>

      {/* Nutrition (read-only) */}
      {edited.nutrition && (
        <section>
          <h3 className="font-semibold text-base mb-3">
            Información nutricional
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              por 100 g
            </span>
          </h3>
          <NutritionTable nutrition={edited.nutrition} />
        </section>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 cursor-pointer"
        >
          Volver
        </Button>
        <Button
          onClick={() => onConfirm(edited)}
          disabled={isSaving || !canSave}
          className="flex-1 cursor-pointer"
          title={!canSave ? "Añade título, ingredientes y pasos" : undefined}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Guardando…
            </>
          ) : (
            <>
              <CheckCircle className="size-4" aria-hidden="true" />
              Guardar receta
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
