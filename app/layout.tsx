import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import { Atkinson_Hyperlegible, Playfair_Display_SC } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggleClient } from "@/components/ThemeToggleClient";
import { AuthMenu } from "@/components/AuthMenu";
import { ServiceWorkerCleanup } from "@/components/ServiceWorkerCleanup";
import "./globals.css";

// Self-hosted by next/font: no request to Google at runtime and no layout shift.
const bodyFont = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Playfair_Display_SC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mincely — Recetas con IA",
    template: "%s — Mincely",
  },
  description:
    "Convierte cualquier receta en datos estructurados con inteligencia artificial",
  applicationName: "Mincely",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Mincely", statusBarStyle: "default" },
  // A personal recipe box — nothing here is meant for search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout extend under the notch / home indicator; padding is restored
  // with env(safe-area-inset-*) where it matters.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0706" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Saltar al contenido
          </a>

          <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md pt-[env(safe-area-inset-top)]">
            <nav
              aria-label="Principal"
              className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4"
            >
              <Link
                href="/"
                className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Image
                  src="/icon-192.png"
                  alt=""
                  width={32}
                  height={32}
                  className="size-8"
                  priority
                />
                <span className="font-display text-xl font-bold text-gradient">
                  Mincely
                </span>
              </Link>
              <div className="flex items-center gap-1">
                <AuthMenu />
                <ThemeToggleClient />
              </div>
            </nav>
          </header>

          <div id="contenido" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </div>

          <Toaster richColors position="top-center" />
          <ServiceWorkerCleanup />
        </ThemeProvider>
      </body>
    </html>
  );
}
