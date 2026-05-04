"use client";

import dynamic from "next/dynamic";
import { FileDown, Loader2 } from "lucide-react";
import { RecipePDF } from "@/components/RecipePDF";
import type { Recipe } from "@/lib/schema";

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => null }
);

export function DownloadPDFButton({ recipe }: { recipe: Recipe }) {
  const filename = `${recipe.title
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, "")
    .trim()
    .replace(/\s+/g, "-")}.pdf`;

  return (
    <PDFDownloadLink
      document={<RecipePDF recipe={recipe} />}
      fileName={filename}
      style={{ textDecoration: "none" }}
    >
      {({ loading }: { loading: boolean }) => (
        <span
          className={[
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            "border border-input bg-background shadow-sm",
            "hover:bg-accent hover:text-accent-foreground",
            loading
              ? "cursor-wait opacity-70"
              : "cursor-pointer",
          ].join(" ")}
          aria-label={loading ? "Generando PDF…" : "Descargar receta en PDF"}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="size-4" aria-hidden="true" />
          )}
          {loading ? "Generando…" : "Descargar PDF"}
        </span>
      )}
    </PDFDownloadLink>
  );
}
