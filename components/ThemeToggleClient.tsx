"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggleClient() {
  const { resolvedTheme, setTheme } = useTheme();

  // The label is deliberately theme-independent: the theme is only known on the
  // client, so a label that named it would not match the server-rendered HTML.
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar entre tema claro y oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="size-11"
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
