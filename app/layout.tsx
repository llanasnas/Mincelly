import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggleClient } from "@/components/ThemeToggleClient";
import { AuthMenu } from "@/components/AuthMenu";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mincely — Recetas con IA",
  description:
    "Convierte cualquier receta en datos estructurados con inteligencia artificial",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
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
                <Image
                  src="/logo.png"
                  alt="Mincely logo"
                  width={42}
                  height={32}
                  className="size-8 rounded-xl"
                  priority
                />
                <span className="font-display text-xl font-bold text-gradient">
                  Mincely
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <AuthMenu />
                <ThemeToggleClient />
              </div>
            </div>
          </nav>

          {children}
          <Toaster richColors position="bottom-center" />
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
