@AGENTS.md

# Recipe Intelligence Engine (Mincely)

## Qué es este proyecto

App de recetas con IA. Convierte cualquier formato de receta (texto, docx, pdf, imagen,
YouTube) en datos estructurados y calcula sus valores nutricionales ingrediente a
ingrediente con datos USDA. Stack: Next.js 16 + TypeScript strict + Anthropic Claude /
OpenAI / Ollama + Neon Postgres. Deploy en Vercel.

## Comandos

- `pnpm dev` → desarrollo local (puerto 3000)
- `pnpm typecheck` → `tsc --noEmit`
- `pnpm lint` → ESLint
- `pnpm test` → tests con Vitest (unitarios + integración de BD sobre PGlite)
- `pnpm build` → build producción (pasar antes de PR)
- `pnpm db:migrate` → ejecutar migrations SQL pendientes en Neon
- `pnpm nutrition:build-reference` → regenerar la tabla de referencia USDA

## Estructura clave

- `/lib/llm/` → LLM abstraction layer (NO tocar sin revisión)
- `/lib/process-recipe.ts` → orquestador principal de IA
- `/lib/llm-output.ts` → limpieza/normalización del output del LLM antes de validar
- `/lib/schema.ts` → Zod schemas = source of truth del modelo de datos
- `/lib/extractors/` → un fichero por tipo de input (text, docx, pdf, image, youtube)
- `/lib/nutrition/engine.ts` → motor nutricional (ver sección propia)
- `/lib/db.ts` → todo el SQL
- `/prompts/parse-recipe.md` → el system prompt (cambios aquí afectan calidad)

## Stack

- Next.js 16 App Router + TypeScript strict
- Zod para validación (SIEMPRE usar safeParse en outputs de LLM)
- Tailwind CSS + shadcn/ui (tema new-york)
- Framer Motion para animaciones
- @neondatabase/serverless (SQL directo, sin ORM)
- Mammoth.js (docx) y unpdf (pdf) SIEMPRE en route handler con `export const runtime = 'nodejs'`

## Provider LLM activo

Controlado por `LLM_PROVIDER` en `.env.local`.
Por defecto: `anthropic` con modelo `claude-haiku-4-5-20251001`.
OpenAI (`gpt-4.1-mini`) y Ollama activos y funcionales.
`ENABLED_PROVIDERS` muestra un selector en la UI; el proveedor elegido se usa para
parsear, para el OCR de imágenes y para las estimaciones nutricionales.

### Modelos Ollama recomendados

- Texto/JSON: `OLLAMA_MODEL=qwen2.5:7b` — mucho mejor seguimiento de schemas JSON que llama3.2
  - Alternativa baja VRAM: `qwen2.5:3b`
  - NO usar `llama3.2:3b` — demasiado pequeño para JSON estructurado complejo
- Visión/imágenes: `OLLAMA_VISION_MODEL=llama3.2-vision:11b`
  - Alternativa si poco VRAM: `llava:13b` (mejor OCR que llava:7b)
  - Instalar con: `ollama pull llama3.2-vision:11b`
  - Si `OLLAMA_VISION_MODEL` no está set → usa `OLLAMA_MODEL` como fallback

## Convenciones de código

- Cada extractor en `/lib/extractors/` exporta una función:
  `async function extract(input: string | Buffer): Promise<string>`
  (los que usan visión aceptan un segundo parámetro opcional `provider`)
- Los Route Handlers que usan mammoth llevan `export const runtime = 'nodejs'`
- NUNCA hacer `JSON.parse()` directo en outputs de LLM — `parseLLMJson()` y después `safeParse()`
- Si Zod falla o el LLM devuelve ingredientes/pasos vacíos: lanzar `RecipeProcessingError` — NO devolver fallback silencioso
- Errores de API: siempre incluir el provider en el mensaje de error
- `RecipeProcessingError(code, message, detail?)`: `message` es para el usuario (español);
  `detail` es técnico, se loguea en servidor y nunca se envía al cliente en producción
- `RecipeSchema` = validación de output LLM (permite arrays vacíos)
- `RecipeSaveSchema` = validación antes de persistir (requiere ≥1 ingrediente y ≥1 paso)
- Todos los errores de extracción/procesado usan `RecipeErrorCode` de `/lib/errors.ts`

## Motor nutricional

`lib/nutrition/engine.ts` calcula los valores por 100 g ingrediente a ingrediente:

1. **Peso**: cantidad → gramos (`parser.ts`). Conversión exacta de unidades > estimación del LLM
   (`ingredient.grams`) > tabla de pesos por unidad.
2. **Perfil** por ingrediente, de más a menos fiable:
   tabla de referencia USDA incluida (`reference-data.ts`, GENERADA, no editar a mano) →
   búsqueda USDA en vivo (`usda.ts`, con ranking propio de candidatos) →
   estimación del LLM solo para ese ingrediente (`llm-estimates.ts`).
3. **Agregado** por peso + merma/absorción de cocción (`cookingYield`).
4. **Informe**: `nutritionMeta` (fuente, cobertura USDA, desglose, notas) viaja con la receta.

Reglas:
- Nunca coger el primer resultado de USDA: pasar por `pickBestMatch`. Sin coincidencia buena
  es mejor que una coincidencia aproximada.
- Un ingrediente sin datos se EXCLUYE del total y del peso (no cuenta como 0 kcal).
- Si el usuario edita un ingrediente, limpiar `grams` / `nameEn` (quedan obsoletos).
- El bloque `nutrition` que devuelve el LLM solo sirve de comprobación cruzada y último recurso.

## Modos de procesado

- **AI MODE** (default): `LLM_PROVIDER=anthropic|openai|ollama` + API key configurada
- **NON-AI MODE**: `LLM_PROVIDER=none` o sin API key → usa parser heurístico (`/lib/parsers/text.ts`)
  - Requiere secciones "Ingredientes" / "Preparación" en el texto
  - La nutrición se sigue calculando (tabla de referencia + USDA), sin estimaciones
  - Imágenes sin AI → error `OCR_FAILED` (tesseract no instalado en MVP)
  - YouTube sin AI → error `TRANSCRIPT_NOT_AVAILABLE`

## Flujo UX de importación

1. Usuario sube input
2. `POST /api/process` → extrae + procesa → Recipe o `{errorCode, error}`
3. Si éxito: mostrar `RecipePreview` — usuario revisa y edita
   (`POST /api/nutrition` recalcula la nutrición tras editar; tampoco persiste)
4. Usuario confirma → `POST /api/recipes` → guarda → redirige
5. Si error: mostrar banner con `errorCode` + mensaje — NO guardar

## Convenciones de prompts

- El system prompt vive en `prompts/parse-recipe.md`, no inline en el código
- Si cambias el prompt, añade una nota al final del archivo con la fecha y el motivo
- El prompt debe pedir SIEMPRE JSON puro, sin markdown, sin explicaciones

## Gotchas conocidos

- Vercel rechaza cuerpos de petición > 4,5 MB antes de llegar a la función: el cliente reduce
  las fotos (`lib/image-resize.ts`) y limita los documentos a 4 MB
- Docx con la receta como imagen incrustada (exportaciones de OneNote / escáner): el extractor
  hace OCR de las imágenes cuando el documento casi no tiene texto
- Turbopack en dev sobre Windows puede dejar procesos `postcss.js` huérfanos tras muchas
  ediciones; si la memoria sube, reiniciar `pnpm dev`
- youtube-transcript usa API no oficial — ahora lanza `TRANSCRIPT_NOT_AVAILABLE` en vez de swallow silencioso
- Neon free tier: cold start de 500ms en primera query tras inactividad
- El LLM a veces envuelve JSON en markdown (`json ... `) — `extractJSON` en
  llm-output.ts ya lo extrae, pero si ves fallos extraños, revisar ahí
- Las categorías viven en tres sitios (`lib/categories.ts`, seeds SQL y el prompt): un test
  comprueba que coinciden
- `RecipeProcessingError` debe ser instanceof-checked ANTES del catch genérico en route handlers

## Fase 2 (NO implementar en MVP)

- Langfuse / observabilidad formal
- Evals con dataset etiquetado
- pgvector para búsqueda semántica
- Import de TikTok / Instagram

## Architecture Principles

- Mantener arquitectura simple pero extensible
- Separar lógica de negocio de infraestructura
- No introducir capas adicionales sin necesidad real
- Optimizar para legibilidad antes que abstracción

## When to Abstract

Solo crear abstracciones si:

- hay al menos 2 implementaciones reales
- o está 100% claro que habrá en breve

## Testing Strategy

- Testear solo lógica crítica
- No testear UI en MVP
- El SQL de `lib/db.ts` se testea contra Postgres real en memoria (PGlite) en `tests/integration`
- Priorizar tests de edge cases sobre cobertura alta

## Simplicity Rule

Si una solución más simple funciona, usarla aunque sea menos “elegante”.
