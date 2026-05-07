import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { UtensilsCrossed } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggleClient } from "@/components/ThemeToggleClient";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mincely — Recetas con IA",
  description:
    "Convierte cualquier receta en datos estructurados con inteligencia artificial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Navbar */}
          <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
              <Link
                href="/"
                className="group flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-sm group-hover:shadow-md group-hover:shadow-primary/30 transition-shadow duration-200">
                  <UtensilsCrossed className="size-4" aria-hidden="true" />
                </span>
                <span className="font-display text-xl font-bold text-gradient">
                  Mincely
                </span>
              </Link>
              <ThemeToggleClient />
            </div>
          </nav>

          {children}
          <Toaster richColors position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
