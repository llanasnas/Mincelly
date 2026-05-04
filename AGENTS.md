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