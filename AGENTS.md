<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Recipe Intelligence Engine (Mincely)

AI-powered recipe parser. Converts text/docx/images/YouTube → structured recipe data.

## Commands

- `pnpm dev` — dev server (port 3000)
- `pnpm build` — production build **run before PR**
- `pnpm lint` — ESLint
- `pnpm db:migrate` — run SQL migrations to Neon

## Stack

- **Next.js 15** App Router
- **TypeScript strict** enabled
- **Zod 4** for validation (always use `safeParse()` on LLM outputs)
- **Tailwind CSS 4** + shadcn/ui (theme: new-york)
- **Framer Motion** for animations
- **@neondatabase/serverless** — direct SQL, no ORM
- **Mammoth.js** for docx — route handlers MUST use `export const runtime = 'nodejs'`

## Architecture

- `/lib/process-recipe.ts` — main AI orchestrator
- `/lib/schema.ts` — Zod schemas = data model source of truth
- `/lib/llm/` — LLM abstraction layer
- `/lib/extractors/` — one file per input type (text, docx, image, youtube)
- `/lib/nutrition/usda.ts` — USDA FoodData Central API client
- `/lib/nutrition/parser.ts` — quantity parser (normalizes "1500 gr" → {qty, unit})
- `/prompts/parse-recipe.md` — system prompt (changes here affect quality)

## LLM + Nutrition Config

`LLM_PROVIDER` in `.env.local`:
- `anthropic` (default) — model: `claude-haiku-4-5-20251001`
- `ollama` — model: `qwen2.5:7b` (better JSON following than llama3.2)
- `ollama` vision — model: `llama3.2-vision:11b` or `llava:13b`
- `none` — heuristic parser (requires "Ingredientes" / "Preparación" sections)

`USDA_API_KEY` (optional): Free API key from https://fdc.nal.usda.gov/api-key-signup
- When configured: real nutrition data from USDA Foundation/SR Legacy foods
- When missing: falls back to LLM estimation

## Quantity Format

The parser normalizes ingredients automatically:
- `"1500 gr"` → `{ quantity: "1500", unit: "g" }`
- `"2 cups"` → `{ quantity: "2", unit: "cup" }`
- `"1/2 tbsp"` → `{ quantity: "1/2", unit: "tbsp" }`

## Error Handling

- NEVER use `JSON.parse()` on LLM output — always `safeParse()`
- LLM may wrap JSON in markdown (` ```json ... ``` `) — regex in `process-recipe.ts` handles this
- Throw `RecipeProcessingError` on validation failure — NO silent fallback
- Use `RecipeErrorCode` from `/lib/errors.ts`
- Errors MUST include provider name

## Known Gotchas

- **Mammoth + Turbopack breaks**: add `experimental: { turbo: false }` in `next.config.ts`
- **Vercel Hobby timeout**: 10s — don't process docx >2MB without background job
- **Neon cold start**: ~500ms delay first query after inactivity (free tier)
- **TypeScript strict**: full strict mode enabled — fix all errors before committing

## Phase 2 (skip in MVP)

- Auth (Better Auth)
- Langfuse observability
- Evals dataset
- OpenAI/Ollama production
- pgvector semantic search

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
