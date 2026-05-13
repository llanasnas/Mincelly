"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Upload,
  Link as LinkIcon,
  FileText,
  Loader2,
  AlertCircle,
  Mic,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecipePreview } from "@/components/RecipePreview";
import type { Recipe } from "@/lib/schema";

// Web Speech API — not yet in all TS lib.dom versions
interface SpeechRecognitionResult {
  isFinal: boolean;
  [i: number]: { transcript: string };
}
interface SpeechRecognitionResultList {
  length: number;
  item(i: number): SpeechRecognitionResult;
  [i: number]: SpeechRecognitionResult;
  [Symbol.iterator](): Iterator<SpeechRecognitionResult>;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare const SpeechRecognition: { new (): SpeechRecognition };

type Tab = "text" | "file" | "youtube";
type Stage = "input" | "processing" | "preview" | "saving";

interface ProcessError {
  errorCode: string;
  error: string;
}

interface ProviderOption {
  id: string;
  label: string;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "text",
    label: "Texto",
    icon: <FileText className="size-4" aria-hidden="true" />,
  },
  {
    id: "file",
    label: "Archivo",
    icon: <Upload className="size-4" aria-hidden="true" />,
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: <LinkIcon className="size-4" aria-hidden="true" />,
  },
];

export function UploadForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("input");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [processError, setProcessError] = useState<ProcessError | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null); // eslint-disable-line no-undef

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data: ProviderOption[]) => {
        setProviders(data);
        if (data.length > 0) setSelectedProvider(data[0].id);
      })
      .catch(() => {
        /* silent — single provider mode */
      });
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: { new (): SpeechRecognition };
      webkitSpeechRecognition?: { new (): SpeechRecognition };
    };
    const SpeechRecognitionAPI =
      w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error(
        "Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.",
      );
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(" ");
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        toast.error(`Error de micrófono: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  async function handleProcess(e: React.FormEvent) {
    e.preventDefault();
    setProcessError(null);
    recognitionRef.current?.stop();

    const fd = new FormData();
    if (tab === "text") {
      if (!text.trim()) {
        toast.error("Pega el texto de la receta.");
        return;
      }
      fd.append("text", text.trim());
    } else if (tab === "file") {
      if (!file) {
        toast.error("Selecciona un archivo.");
        return;
      }
      fd.append("file", file);
    } else {
      if (!url.trim()) {
        toast.error("Pega la URL de YouTube.");
        return;
      }
      fd.append("url", url.trim());
    }

    if (selectedProvider) fd.append("provider", selectedProvider);

    setStage("processing");
    startTransition(async () => {
      try {
        const res = await fetch("/api/process", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok) {
          setStage("input");
          setProcessError({
            errorCode:
              (data as { errorCode?: string }).errorCode ?? "PARSING_FAILED",
            error: (data as { error?: string }).error ?? "Error al procesar",
          });
          return;
        }

        setRecipe(data as Recipe);
        setStage("preview");
      } catch {
        setStage("input");
        setProcessError({
          errorCode: "PARSING_FAILED",
          error: "Error de red. Inténtalo de nuevo.",
        });
      }
    });
  }

  async function handleSave(editedRecipe: Recipe) {
    setRecipe(editedRecipe);
    setStage("saving");
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedRecipe),
      });
      const data = await res.json();
      if (!res.ok) {
        setStage("preview");
        toast.error((data as { error?: string }).error ?? "Error al guardar");
        return;
      }
      toast.success("Receta guardada correctamente.");
      router.push(`/recipes/${(data as { id: number }).id}`);
    } catch {
      setStage("preview");
      toast.error("Error de red. Inténtalo de nuevo.");
    }
  }

  function handleCancel() {
    setRecipe(null);
    setStage("input");
    setProcessError(null);
  }

  if (stage === "preview" || stage === "saving") {
    return (
      <RecipePreview
        recipe={recipe!}
        onConfirm={(edited) => handleSave(edited)}
        onCancel={handleCancel}
        isSaving={stage === "saving"}
      />
    );
  }

  const isProcessing = stage === "processing";

  return (
    <form onSubmit={handleProcess} className="space-y-6" noValidate>
      {processError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex gap-3"
        >
          <AlertCircle
            className="size-5 text-destructive shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-sm space-y-0.5">
            <p className="font-medium text-destructive">
              {processError.errorCode}
            </p>
            <p className="text-destructive/80">{processError.error}</p>
          </div>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Tipo de entrada"
        className="flex gap-1 rounded-xl bg-muted p-1"
      >
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`tab-panel-${id}`}
            onClick={() => {
              setTab(id);
              setProcessError(null);
            }}
            className={[
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-medium",
              "transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {tab === "text" && (
          <div id="tab-panel-text" role="tabpanel" aria-label="Texto de receta">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="recipe-text" className="text-base font-medium">
                Pega o escribe la receta
              </label>
              <button
                type="button"
                onClick={toggleRecording}
                aria-label={
                  isRecording ? "Detener grabación" : "Grabar por voz"
                }
                aria-pressed={isRecording}
                className={[
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
                  "transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isRecording
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 animate-pulse"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
                ].join(" ")}
              >
                {isRecording ? (
                  <>
                    <Square
                      className="size-3.5 fill-current"
                      aria-hidden="true"
                    />{" "}
                    Detener
                  </>
                ) : (
                  <>
                    <Mic className="size-3.5" aria-hidden="true" /> Voz
                  </>
                )}
              </button>
            </div>
            <textarea
              id="recipe-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="Ingredientes: 200g harina, 2 huevos…"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>
        )}

        {tab === "file" && (
          <div id="tab-panel-file" role="tabpanel" aria-label="Subir archivo">
            <label
              htmlFor="recipe-file"
              className="block text-base font-medium mb-2"
            >
              Archivo .docx o imagen
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) =>
                e.key === "Enter" && fileInputRef.current?.click()
              }
              tabIndex={0}
              role="button"
              aria-label="Seleccionar archivo"
              className={[
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed",
                "border-input bg-muted/50 px-6 py-12 cursor-pointer",
                "transition-colors duration-150 hover:border-primary/60 hover:bg-primary/5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ].join(" ")}
            >
              <Upload
                className="size-10 text-muted-foreground"
                aria-hidden="true"
              />
              {file ? (
                <span className="text-lg font-medium text-primary">
                  {file.name}
                </span>
              ) : (
                <>
                  <span className="text-base font-medium">
                    Haz clic para seleccionar
                  </span>
                  <span className="text-sm text-muted-foreground">
                    .docx, .jpg, .png, .webp
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="recipe-file"
              type="file"
              accept=".docx,.jpg,.jpeg,.png,.gif,.webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-hidden="true"
            />
          </div>
        )}

        {tab === "youtube" && (
          <div
            id="tab-panel-youtube"
            role="tabpanel"
            aria-label="URL de YouTube"
          >
            <label
              htmlFor="recipe-url"
              className="block text-base font-medium mb-2"
            >
              URL del vídeo de YouTube
            </label>
            <input
              id="recipe-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Se extraerá la transcripción automáticamente. Si no está
              disponible, verás un error con instrucciones.
            </p>
          </div>
        )}
      </motion.div>

      {providers.length > 1 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            IA a usar
          </p>
          <div
            role="radiogroup"
            aria-label="Seleccionar proveedor de IA"
            className="flex gap-2 flex-wrap"
          >
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selectedProvider === p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={[
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedProvider === p.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input bg-background text-foreground hover:border-primary/60",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isProcessing}
        className="w-full text-lg h-14 cursor-pointer"
        aria-live="polite"
      >
        {isProcessing ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Procesando…
          </>
        ) : (
          "Analizar receta con IA"
        )}
      </Button>
    </form>
  );
}
