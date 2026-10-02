"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Link as LinkIcon,
  FileText,
  Loader2,
  AlertCircle,
  Mic,
  Square,
  ImageIcon,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecipePreview } from "@/components/RecipePreview";
import { downscaleImage } from "@/lib/image-resize";
import type { Recipe } from "@/lib/schema";
import { cn } from "@/lib/utils";

// Web Speech API — not yet in all TS lib.dom versions
interface SpeechRecognitionResult {
  isFinal: boolean;
  [i: number]: { transcript: string };
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
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
type SpeechRecognitionConstructor = { new (): SpeechRecognition };

type Tab = "text" | "file" | "youtube";
type Stage = "input" | "processing" | "preview" | "saving";

interface ProcessError {
  errorCode: string;
  error: string;
  /** Request diagnostics, shown on demand. Phones have no devtools to look at. */
  debug?: string;
}

interface ProviderOption {
  id: string;
  label: string;
}

interface ApiErrorBody {
  errorCode?: string;
  error?: string;
  detail?: string;
}

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "text", label: "Texto", icon: FileText },
  { id: "file", label: "Archivo", icon: Paperclip },
  { id: "youtube", label: "YouTube", icon: LinkIcon },
];

const ERROR_TITLES: Record<string, string> = {
  EMPTY_CONTENT: "Falta contenido",
  OCR_FAILED: "No se pudo leer la imagen",
  TRANSCRIPT_NOT_AVAILABLE: "Vídeo sin transcripción",
  PARSING_FAILED: "No se pudo leer el contenido",
  AI_EXTRACTION_FAILED: "No se pudo extraer la receta",
  RATE_LIMITED: "Demasiadas peticiones",
  UNAUTHORIZED: "Sesión caducada",
  NETWORK: "Sin conexión con el servidor",
  TIMEOUT: "La petición tardó demasiado",
};

/** Slightly above the server's 60 s limit, so the server's own error wins when there is one. */
const REQUEST_TIMEOUT_MS = 65_000;
/** Vercel rejects request bodies over 4.5 MB; leave room for the multipart envelope. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const DOC_ACCEPT =
  ".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const fieldCls =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60";

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface PostResult {
  status: number;
  statusText: string;
  body: string;
  contentType: string;
}

// XHR instead of fetch: it reports upload progress, and tells "never left the
// device" (0 bytes sent) apart from "connection dropped half-way" — fetch only
// says "Failed to fetch" for both.
function postForm(
  url: string,
  body: FormData,
  onUploadProgress: (sent: number, total: number) => void,
): Promise<PostResult> {
  return new Promise((resolve, reject) => {
    const fail = (name: string, message: string) => {
      const error = new Error(message);
      error.name = name;
      reject(error);
    };

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    xhr.upload.onprogress = (e) => onUploadProgress(e.loaded, e.total);
    xhr.onload = () =>
      resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        body: xhr.responseText ?? "",
        contentType: xhr.getResponseHeader("content-type") ?? "?",
      });
    xhr.onerror = () => fail("NetworkError", "Request blocked or connection reset (status 0)");
    xhr.ontimeout = () => fail("TimeoutError", "Request timed out");
    xhr.send(body);
  });
}

export function UploadForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>("input");
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [processError, setProcessError] = useState<ProcessError | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => () => recognitionRef.current?.stop(), []);

  // Release the thumbnail's object URL when the form goes away.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  /** Sets the selected file together with its thumbnail (photos only). */
  function updateFile(next: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next?.type.startsWith("image/") ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewUrlRef.current);
    setFile(next);
  }

  // Bring the error into view — on a phone it would otherwise appear above the fold.
  useEffect(() => {
    if (processError) errorRef.current?.focus();
  }, [processError]);

  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionAPI = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error("Tu navegador no permite dictar por voz. Prueba con Chrome o Edge.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(" ");
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        toast.error("Permite el acceso al micrófono para dictar la receta.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        toast.error(`Error de micrófono: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function selectFile(selected: File | null | undefined) {
    setProcessError(null);
    if (!selected) return;

    const isImage = selected.type.startsWith("image/");
    const isDocument = /\.(docx|pdf)$/i.test(selected.name);
    if (!isImage && !isDocument) {
      toast.error("Formato no compatible. Usa una imagen, un .docx o un .pdf.");
      return;
    }
    // Images are downscaled before upload, so only documents can be too big.
    if (!isImage && selected.size > MAX_UPLOAD_BYTES) {
      toast.error(`El documento pesa ${formatBytes(selected.size)}. El máximo son 4 MB.`);
      return;
    }
    updateFile(selected);
  }

  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    setTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  async function handleProcess(e: React.FormEvent) {
    e.preventDefault();
    setProcessError(null);
    recognitionRef.current?.stop();

    const fd = new FormData();
    let upload: File | null = null;

    if (tab === "text") {
      if (!text.trim()) {
        toast.error("Pega o escribe el texto de la receta.");
        return;
      }
      fd.append("text", text.trim());
    } else if (tab === "file") {
      if (!file) {
        toast.error("Elige una foto o un documento.");
        return;
      }
      setStage("processing");
      upload = await downscaleImage(file);
      if (upload.size > MAX_UPLOAD_BYTES) {
        setStage("input");
        setProcessError({
          errorCode: "PARSING_FAILED",
          error: `El archivo pesa ${formatBytes(upload.size)} y el máximo son 4 MB. Prueba con una foto de menor resolución.`,
        });
        return;
      }
      fd.append("file", upload);
    } else {
      if (!url.trim()) {
        toast.error("Pega el enlace del vídeo de YouTube.");
        return;
      }
      fd.append("url", url.trim());
    }

    if (selectedProvider) fd.append("provider", selectedProvider);

    setStage("processing");
    setUploadPercent(upload ? 0 : null);

    const startTime = Date.now();
    let sentBytes = 0;
    let totalBytes = upload?.size ?? 0;

    const diagnostics = (lines: string[]) => {
      const connection = (navigator as unknown as { connection?: { effectiveType?: string } })
        .connection;
      return [
        ...lines,
        `elapsed=${Date.now() - startTime}ms`,
        `uploaded=${sentBytes}/${totalBytes}B`,
        `input=${tab}`,
        upload ? `file="${upload.name}" size=${upload.size}B type="${upload.type || "?"}"` : "",
        file && upload && upload !== file ? `original size=${file.size}B type="${file.type || "?"}"` : "",
        `online=${navigator.onLine}`,
        connection?.effectiveType ? `net=${connection.effectiveType}` : "",
        `ua=${navigator.userAgent}`,
      ]
        .filter(Boolean)
        .join("\n");
    };

    try {
      const result = await postForm("/api/process", fd, (sent, total) => {
        sentBytes = sent;
        if (total) totalBytes = total;
        if (upload && total) setUploadPercent(Math.round((sent / total) * 100));
      });

      let data: (ApiErrorBody & Partial<Recipe>) | null = null;
      try {
        data = result.body ? JSON.parse(result.body) : null;
      } catch {
        data = null;
      }
      const ok = result.status >= 200 && result.status < 300;

      if (!ok || !data) {
        const fallback =
          result.status === 413
            ? "El archivo es demasiado grande para enviarlo. Prueba con uno más pequeño."
            : result.status === 401
              ? "Tu sesión ha caducado. Recarga la página e inicia sesión de nuevo."
              : `El servidor respondió con un error (${result.status}). Inténtalo de nuevo.`;
        setStage("input");
        setProcessError({
          errorCode: data?.errorCode ?? "PARSING_FAILED",
          error: data?.error ?? fallback,
          debug: diagnostics([
            `status=${result.status} ${result.statusText}`,
            `content-type=${result.contentType}`,
            data?.detail ? `detail=${data.detail}` : `body=${result.body.slice(0, 400)}`,
          ]),
        });
        return;
      }

      setRecipe(data as Recipe);
      setStage("preview");
      window.scrollTo({ top: 0 });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      setStage("input");
      setProcessError({
        errorCode: isTimeout ? "TIMEOUT" : "NETWORK",
        error: isTimeout
          ? "El servidor no ha respondido a tiempo. Vuelve a intentarlo; si es una foto, prueba con una más ligera."
          : "No se pudo contactar con el servidor. Comprueba tu conexión y vuelve a intentarlo.",
        debug: diagnostics([
          `error=${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
        ]),
      });
    } finally {
      setUploadPercent(null);
    }
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
      const data = (await res.json().catch(() => null)) as { id?: number; error?: string } | null;
      if (!res.ok || !data?.id) {
        setStage("preview");
        toast.error(data?.error ?? "No se pudo guardar la receta.");
        return;
      }
      toast.success("Receta guardada.");
      router.push(`/recipes/${data.id}`);
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

  if ((stage === "preview" || stage === "saving") && recipe) {
    return (
      <RecipePreview
        recipe={recipe}
        onConfirm={handleSave}
        onCancel={handleCancel}
        cancelLabel="Descartar"
        isSaving={stage === "saving"}
        provider={selectedProvider || undefined}
        unsaved
      />
    );
  }

  const isProcessing = stage === "processing";
  const isImage = !!file && file.type.startsWith("image/");

  return (
    <form onSubmit={handleProcess} className="space-y-6 pb-12" noValidate>
      {processError && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 outline-none"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-1 text-base">
            <p className="font-bold text-destructive">
              {ERROR_TITLES[processError.errorCode] ?? "Algo ha fallado"}
            </p>
            <p className="text-foreground">{processError.error}</p>
            {processError.debug && (
              <details className="pt-1 text-sm">
                <summary className="inline-flex min-h-9 cursor-pointer items-center text-muted-foreground underline-offset-4 hover:underline">
                  Detalles técnicos
                </summary>
                <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-background/60 p-3 font-mono text-xs leading-snug text-muted-foreground">
                  {processError.debug}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard
                      ?.writeText(`${processError.errorCode}: ${processError.error}\n${processError.debug}`)
                      .then(() => toast.success("Copiado."))
                      .catch(() => toast.error("No se pudo copiar."))
                  }
                  className="mt-1 inline-flex min-h-9 cursor-pointer items-center text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Copiar detalles
                </button>
              </details>
            )}
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Origen de la receta" className="flex gap-1 rounded-xl bg-muted p-1">
        {TABS.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`tab-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            disabled={isProcessing}
            onKeyDown={(e) => onTabKeyDown(e, index)}
            onClick={() => {
              setTab(id);
              setProcessError(null);
            }}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-base font-medium",
              "transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <motion.div
        key={tab}
        id={`tab-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {tab === "text" && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="recipe-text" className="text-base font-bold">
                Texto de la receta
              </label>
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isProcessing}
                aria-pressed={isRecording}
                className={cn(
                  "flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
                  "transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isRecording
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-foreground hover:bg-muted/70",
                )}
              >
                {isRecording ? (
                  <>
                    <Square className="size-3.5 animate-pulse fill-current" aria-hidden="true" />
                    Parar dictado
                  </>
                ) : (
                  <>
                    <Mic className="size-4" aria-hidden="true" />
                    Dictar
                  </>
                )}
              </button>
            </div>
            <textarea
              id="recipe-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isProcessing}
              rows={10}
              placeholder={"Tortilla de patatas\n\nIngredientes:\n500 g de patatas\n4 huevos\n…"}
              className={cn(fieldCls, "resize-y leading-relaxed")}
            />
          </div>
        )}

        {tab === "file" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              selectFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "space-y-3 rounded-2xl transition-shadow",
              dragging && "ring-2 ring-primary ring-offset-4 ring-offset-background",
            )}
          >
            <p className="text-base font-bold">Foto o documento</p>

            {/* Two separate inputs: an image-only input makes phones offer the
                camera and gallery, a document input opens the file browser. */}
            <div className="grid grid-cols-2 gap-3">
              <FileTile
                icon={ImageIcon}
                title="Foto"
                hint="JPG, PNG, WebP"
                accept="image/*"
                active={isImage}
                disabled={isProcessing}
                onSelect={selectFile}
              />
              <FileTile
                icon={FileText}
                title="Documento"
                hint="Word (.docx) o PDF"
                accept={DOC_ACCEPT}
                active={!!file && !isImage}
                disabled={isProcessing}
                onSelect={selectFile}
              />
            </div>

            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                {previewUrl ? (
                  // A local object URL: next/image has nothing to optimise here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateFile(null)}
                  disabled={isProcessing}
                  aria-label="Quitar archivo"
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground max-sm:hidden">
                También puedes arrastrar el archivo hasta aquí.
              </p>
            )}
          </div>
        )}

        {tab === "youtube" && (
          <div>
            <label htmlFor="recipe-url" className="mb-2 block text-base font-bold">
              Enlace del vídeo
            </label>
            <input
              id="recipe-url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-describedby="recipe-url-hint"
              className={fieldCls}
            />
            <p id="recipe-url-hint" className="mt-2 text-sm text-muted-foreground">
              La receta se extrae de los subtítulos del vídeo, así que tiene que tenerlos
              (los automáticos también sirven).
            </p>
          </div>
        )}
      </motion.div>

      {providers.length > 1 && (
        <fieldset disabled={isProcessing}>
          <legend className="mb-2 text-sm font-bold text-muted-foreground">Modelo de IA</legend>
          <div role="radiogroup" aria-label="Modelo de IA" className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selectedProvider === p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-medium transition-colors cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedProvider === p.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:border-primary/60",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="space-y-3">
        <Button type="submit" size="lg" disabled={isProcessing} className="h-14 w-full text-lg">
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Analizando…
            </>
          ) : (
            "Analizar receta"
          )}
        </Button>

        <div aria-live="polite" className="min-h-6 text-center text-sm text-muted-foreground">
          {isProcessing &&
            (uploadPercent !== null && uploadPercent < 100
              ? `Subiendo el archivo… ${uploadPercent} %`
              : "Leyendo la receta y calculando sus valores nutricionales. Suele tardar entre 10 y 30 segundos.")}
        </div>
      </div>
    </form>
  );
}

function FileTile({
  icon: Icon,
  title,
  hint,
  accept,
  active,
  disabled,
  onSelect,
}: {
  icon: typeof FileText;
  title: string;
  hint: string;
  accept: string;
  active: boolean;
  disabled: boolean;
  onSelect: (file: File | undefined) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-6 text-center transition-colors duration-150",
        "hover:border-primary/60 hover:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        active ? "border-primary bg-primary/5" : "border-input bg-muted/40",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onSelect(e.target.files?.[0]);
          // Allow picking the same file again after removing it.
          e.target.value = "";
        }}
      />
      <Icon className="size-7 text-muted-foreground" aria-hidden="true" />
      <span className="text-base font-bold">{title}</span>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </label>
  );
}
