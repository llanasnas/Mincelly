"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteRecipeButton({ id }: { id: number }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true);
      // Reset confirmation after 3 s if user doesn't click again
      setTimeout(() => setConfirmed(false), 3000);
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Receta eliminada.");
        router.push("/");
        router.refresh();
      } else {
        toast.error("No se pudo eliminar la receta.");
        setConfirmed(false);
      }
    });
  }

  return (
    <Button
      variant={confirmed ? "destructive" : "outline"}
      size="lg"
      onClick={handleClick}
      disabled={isPending}
      className="text-base gap-2 cursor-pointer min-w-36"
      aria-label={confirmed ? "Confirmar borrado" : "Borrar receta"}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="size-4" aria-hidden="true" />
      )}
      {confirmed ? "¿Seguro?" : "Eliminar"}
    </Button>
  );
}
