@AGENTS.md

# Recipe Intelligence Engine (Mincely)

## Qué es este proyecto

App de recetas con IA. Convierte cualquier formato de receta (texto, docx, imagen,
YouTube) en datos estructurados. Stack: Next.js 15 + TypeScript strict + Anthropic
Claude + Neon Postgres. Deploy en Vercel.

## Comandos

- `pnpm dev` → desarrollo local (puerto 3000)
- `pnpm build` → build producción (pasar antes de PR)
- `pnpm test` → tests con Vitest
- `pnpm db:migrate` → ejecutar migrations SQL en Neon

## Estructura clave

- `/lib/llm/` → LLM abstraction layer (NO tocar sin revisión)
- `/lib/process-recipe.ts` → orquestador principal de IA
- `/lib/schema.ts` → Zod schemas = source of truth del modelo de datos
- `/lib/extractors/` → un fichero por tipo de input
- `/prompts/parse-recipe.md` → el system prompt (cambios aquí afectan calidad)

## Stack

- Next.js 15 App Router + TypeScript strict
- Zod para validación (SIEMPRE usar safeParse en outputs de LLM)
- Tailwind CSS + shadcn/ui (tema new-york)
- Framer Motion para animaciones
- @neondatabase/serverless (SQL directo, sin ORM)
- Mammoth.js SIEMPRE en route handler con `export const runtime = 'nodejs'`

## Provider LLM activo

Controlado por `LLM_PROVIDER` en `.env.local`.
Por defecto: `anthropic` con modelo `claude-haiku-4-5-20251001`.
OpenAI es stub. Ollama activo y funcional.

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
- Los Route Handlers que usan mammoth llevan `export const runtime = 'nodejs'`
- NUNCA hacer `JSON.parse()` directo en outputs de LLM — siempre `safeParse()`
- Si Zod falla o el LLM devuelve ingredientes/pasos vacíos: lanzar `RecipeProcessingError` — NO devolver fallback silencioso
- Errores de API: siempre incluir el provider en el mensaje de error
- `RecipeSchema` = validación de output LLM (permite arrays vacíos)
- `RecipeSaveSchema` = validación antes de persistir (requiere ≥1 ingrediente y ≥1 paso)
- Todos los errores de extracción/procesado usan `RecipeErrorCode` de `/lib/errors.ts`

## Modos de procesado

- **AI MODE** (default): `LLM_PROVIDER=anthropic|openai|ollama` + API key configurada
- **NON-AI MODE**: `LLM_PROVIDER=none` o sin API key → usa parser heurístico (`/lib/parsers/text.ts`)
  - Requiere secciones "Ingredientes" / "Preparación" en el texto
  - Imágenes sin AI → error `OCR_FAILED` (tesseract no instalado en MVP)
  - YouTube sin AI → error `TRANSCRIPT_NOT_AVAILABLE`

## Flujo UX de importación

1. Usuario sube input
2. `POST /api/process` → extrae + procesa → Recipe o `{errorCode, error}`
3. Si éxito: mostrar `RecipePreview` — usuario revisa
4. Usuario confirma → `POST /api/recipes` → guarda → redirige
5. Si error: mostrar banner con `errorCode` + mensaje — NO guardar

## Convenciones de prompts

- El system prompt vive en `prompts/parse-recipe.md`, no inline en el código
- Si cambias el prompt, añade una nota al final del archivo con la fecha y el motivo
- El prompt debe pedir SIEMPRE JSON puro, sin markdown, sin explicaciones

## Gotchas conocidos

- Mammoth + Turbopack rompe: `experimental: { turbo: false }` en next.config.ts
- Vercel Hobby timeout: 10s — no procesar docx > 2MB sin mover a `after()`
- youtube-transcript usa API no oficial — ahora lanza `TRANSCRIPT_NOT_AVAILABLE` en vez de swallow silencioso
- Neon free tier: cold start de 500ms en primera query tras inactividad
- El LLM a veces envuelve JSON en markdown (`json ... `) — el regex en
  process-recipe.ts ya lo extrae, pero si ves fallos extraños, revisar ahí
- `RecipeProcessingError` debe ser instanceof-checked ANTES del catch genérico en route handlers

## Fase 2 (NO implementar en MVP)

- Auth de usuarios (Better Auth)
- Langfuse / observabilidad formal
- Evals con dataset etiquetado
- OpenAI / Ollama en producción
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
- Priorizar tests de edge cases sobre cobertura alta

## Simplicity Rule

Si una solución más simple funciona, usarla aunque sea menos “elegante”.
