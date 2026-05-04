"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggleClient() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        resolvedTheme === "dark"
          ? "Cambiar a modo claro"
          : "Cambiar a modo oscuro"
      }
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="size-10 cursor-pointer"
    >
      <Sun
        className="size-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute size-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100"
        aria-hidden="true"
      />
    </Button>
  );
}
