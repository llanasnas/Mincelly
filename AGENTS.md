<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Recipe Intelligence Engine (Mincely)

AI-powered recipe parser. Converts text / docx / pdf / images / YouTube → structured recipe data,
with nutrition computed ingredient by ingredient from USDA data.

## Commands

- `pnpm dev` — dev server (port 3000)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — ESLint
- `pnpm test` — Vitest (unit + DB integration on PGlite; no network, no services)
- `pnpm build` — production build **run before PR**
- `pnpm db:migrate` — apply pending SQL migrations to Neon
- `pnpm nutrition:build-reference` — regenerate `lib/nutrition/reference-data.ts` from USDA

CI runs typecheck, lint, test and build. Package manager is **pnpm** (Vercel builds with it too).

## Stack

- **Next.js 16** App Router (Turbopack), React 19
- **TypeScript strict** enabled
- **Zod 4** for validation (always use `safeParse()` on LLM outputs)
- **Tailwind CSS 4** + shadcn/ui
- **Framer Motion** — only where motion conveys state; no page-load choreography
- **@neondatabase/serverless** — direct SQL, no ORM
- **Mammoth.js** for docx, **unpdf** for pdf — route handlers MUST use `export const runtime = 'nodejs'`

## Architecture

- `/lib/process-recipe.ts` — main orchestrator: sanitise → LLM parse → validate → nutrition
- `/lib/llm-output.ts` — turns raw LLM text into something Zod can validate
- `/lib/schema.ts` — Zod schemas = data model source of truth
- `/lib/llm/` — LLM abstraction layer (do not change without review)
- `/lib/extractors/` — one file per input type (text, docx, pdf, image, youtube); `index.ts` routes
- `/lib/nutrition/engine.ts` — nutrition engine (weights → per-ingredient profile → aggregate → report)
- `/lib/nutrition/usda.ts` — USDA FoodData Central client + candidate ranking
- `/lib/nutrition/reference-data.ts` — GENERATED snapshot of pantry staples; never edit by hand
- `/lib/nutrition/parser.ts` — quantities and units → grams
- `/lib/db.ts` — all SQL
- `/lib/api.ts` — API error shape + rate limiting helper
- `/prompts/parse-recipe.md` — system prompt (changes here affect quality)
- `/proxy.ts` — auth gate (Next 16 name for middleware)

## LLM + Nutrition Config

`LLM_PROVIDER` in `.env.local`:
- `anthropic` (default) — model: `claude-haiku-4-5-20251001`
- `openai` — model: `gpt-4.1-mini`
- `ollama` — model: `qwen2.5:7b` (better JSON following than llama3.2)
- `ollama` vision — model: `llama3.2-vision:11b` or `llava:13b`
- `none` — heuristic parser (requires "Ingredientes" / "Preparación" sections)

`ENABLED_PROVIDERS=anthropic,openai` shows a provider picker; the picked provider is used for
parsing, image OCR and nutrition estimates alike.

Nutrition resolves each ingredient through three tiers, most trustworthy first:
1. bundled USDA snapshot (`reference-data.ts`) — exact match only, no network
2. live USDA search — needs `USDA_API_KEY` (free: https://fdc.nal.usda.gov/api-key-signup)
3. per-ingredient LLM estimate — one batched call for whatever is left

The LLM's whole-dish `nutrition` block is only a cross-check and last-resort fallback.

## Quantity Format

Quantity and unit are separate fields. A unit glued to the quantity is split out:
- `"1500 gr"` → `{ quantity: "1500", unit: "g" }` (metric units are normalised)
- `"2 tazas"` → `{ quantity: "2", unit: "tazas" }` (other units keep the recipe's wording)

For conversion, units are canonicalised internally (`canonicalUnit`): "cucharadas" → `tbsp`, etc.
Each ingredient may also carry `nameEn` (English name for database lookups) and `grams`
(estimated weight) — hints produced by the LLM; clear them when the user edits the ingredient.

## Error Handling

- NEVER use `JSON.parse()` directly on LLM output — use `parseLLMJson()` then `safeParse()`
- LLM may wrap JSON in markdown (` ```json ... ``` `) — `extractJSON` in `llm-output.ts` handles this
- Throw `RecipeProcessingError` on validation failure — NO silent fallback
- `RecipeProcessingError(code, message, detail?)`: `message` is user-facing (Spanish) and includes
  the provider name in brackets; `detail` is technical, logged server-side, never sent in production
- Use `RecipeErrorCode` from `/lib/errors.ts`
- API routes respond with `{ errorCode, error }` via `errorResponse()` from `/lib/api.ts`

## Known Gotchas

- **Vercel body limit**: requests over 4.5 MB are rejected before reaching the function — the client
  downscales photos (`lib/image-resize.ts`) and caps documents at 4 MB
- **Docx with the recipe as an image**: common (OneNote / scanner exports). `extractors/docx.ts`
  OCRs embedded images when the document has little text
- **USDA search is not an ingredient matcher**: never take the first hit — go through `pickBestMatch`
- **Turbopack dev on Windows** can leak `postcss.js` worker processes after many edits; if memory
  climbs, restart `pnpm dev`
- **Neon cold start**: ~500ms delay first query after inactivity (free tier)
- **Categories live in three places** (`lib/categories.ts`, SQL seeds, the prompt) — a test enforces
  that they match
- **TypeScript strict**: full strict mode enabled — fix all errors before committing

## Not built yet

- Langfuse observability
- Evals dataset
- pgvector semantic search
- TikTok / Instagram import

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Tool |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "How does X reach/become Y? / trace the flow from X to Y" | `codegraph_trace` (one call = the whole path, incl. callback/React/JSX dynamic hops) |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. For a specific **flow** ("how does X reach Y") start with `codegraph_trace` from→to — one call returns the whole path with dynamic hops bridged — then ONE `codegraph_explore` for the bodies; don't rebuild the path with `codegraph_search` + `codegraph_callers`. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->
