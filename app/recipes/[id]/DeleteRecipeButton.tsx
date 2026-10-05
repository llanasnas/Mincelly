"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** How long the "¿Seguro?" state waits for the confirming click before resetting. */
const CONFIRM_WINDOW_MS = 4000;

/**
 * Two-step delete: the first click arms the button, the second one deletes.
 * Cheaper than a modal and just as safe for a single, clearly labelled action.
 */
export function DeleteRecipeButton({ id }: { id: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(String(res.status));
        toast.success("Receta eliminada.");
        router.push("/");
        router.refresh();
      } catch {
        toast.error("No se pudo eliminar la receta. Inténtalo de nuevo.");
        setArmed(false);
      }
    });
  }

  return (
    <Button
      variant={armed ? "destructive" : "outline"}
      size="lg"
      onClick={handleClick}
      disabled={isPending}
      className={armed ? undefined : "max-sm:size-11 max-sm:px-0"}
    >
      {isPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 aria-hidden="true" />
      )}
      {/* Once armed the label shows on every screen size — the question must be readable. */}
      <span className={armed ? undefined : "max-sm:sr-only"} aria-live="polite">
        {armed ? "¿Seguro?" : "Eliminar"}
      </span>
    </Button>
  );
}
