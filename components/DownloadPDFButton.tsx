"use client";

import dynamic from "next/dynamic";
import { FileDown, Loader2 } from "lucide-react";
import { RecipePDF } from "@/components/RecipePDF";
import { buttonVariants } from "@/components/ui/button";
import type { Recipe } from "@/lib/schema";
import { cn } from "@/lib/utils";

// @react-pdf/renderer is browser-only and heavy: load it on the client, on demand.
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <PDFButtonLabel loading /> },
);

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "receta";
}

function PDFButtonLabel({ loading }: { loading: boolean }) {
  return (
    <span
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        "max-sm:size-11 max-sm:px-0",
        loading && "cursor-wait opacity-70",
      )}
    >
      {loading ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <FileDown aria-hidden="true" />
      )}
      <span className="max-sm:sr-only">Descargar PDF</span>
    </span>
  );
}

export function DownloadPDFButton({ recipe }: { recipe: Recipe }) {
  return (
    <PDFDownloadLink
      document={<RecipePDF recipe={recipe} />}
      fileName={`${slugify(recipe.title)}.pdf`}
      style={{ textDecoration: "none" }}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {({ loading }: { loading: boolean }) => <PDFButtonLabel loading={loading} />}
    </PDFDownloadLink>
  );
}
