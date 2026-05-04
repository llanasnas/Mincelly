<div align="center">

# 🍽️ Mincely

**Recipe Intelligence Engine** — Converts any recipe format into structured data, powered by AI.

[![Next.js](https://img.shields.io/badge/Next.js_15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Why I built this

My father has always been passionate about cooking. He managed dozens of recipes, but they were scattered everywhere — handwritten notes, screenshots, WhatsApp messages, YouTube videos. What he really wanted was a single place to store them in a clean, structured way, and to instantly know the nutritional macros of each dish.

That conversation became the seed for Mincely. I decided to build it not just to solve his problem, but to challenge myself as a developer: to create a real, production-grade, AI-powered application using modern best practices — from prompt engineering and multi-provider LLM routing to secure API design and a polished UI.

The result is an app that turns any recipe — pasted text, a Word document, a photo, or a YouTube video — into structured data with ingredients, steps, categories and nutrition information, in seconds.

---

## Features

- 📝 **Multi-format import** — plain text, `.docx`, images (JPG/PNG/WebP), YouTube videos
- 🤖 **Multi-provider AI** — Anthropic Claude, OpenAI ChatGPT, or Ollama (local/offline)
- 🥗 **Nutrition data** — macro calculation via USDA FoodData Central API with LLM fallback
- ✏️ **Edit & preview** — review parsed results before saving, full edit support
- 🗂️ **Categories & filters** — organize and search your recipe library
- 📄 **PDF export** — download any recipe as a clean PDF
- 🌙 **Dark mode** — system-aware theme

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (new-york) |
| Animations | Framer Motion |
| Database | Neon Postgres (serverless) |
| AI / LLM | Anthropic, OpenAI, Ollama |
| Nutrition | USDA FoodData Central |
| Images | Cloudinary |
| Validation | Zod 4 |

---

## Getting Started

### Prerequisites

- Node.js 18+ and [pnpm](https://pnpm.io)
- A [Neon](https://neon.tech) Postgres database (free tier works)
- At least one LLM provider (see [Configuration](#configuration))

### 1. Clone and install

```bash
git clone https://github.com/your-username/mincely.git
cd mincely
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials. See [Configuration](#configuration) for all options.

### 3. Run database migrations

```bash
pnpm db:migrate
```

This creates the `recipes`, `categories`, `ingredients`, and related tables in your Neon database.

### 4. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration

All configuration lives in `.env.local` (never committed to git).

### Required

```env
# Neon Postgres connection string
DATABASE_URL=postgres://user:pass@host.neon.tech/dbname
```

### LLM Provider (choose one or more)

```env
# Active provider: anthropic | openai | ollama | none
LLM_PROVIDER=anthropic

# To enable multiple providers and show a selector in the UI:
# ENABLED_PROVIDERS=anthropic,openai,ollama

# Anthropic Claude (default model: claude-haiku-4-5)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI ChatGPT (default model: gpt-4o-mini)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini          # optional

# Ollama — local, no API key needed
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b           # recommended for JSON following
OLLAMA_VISION_MODEL=llama3.2-vision:11b  # for image parsing
```

> **No API key?** Set `LLM_PROVIDER=none` to use the built-in heuristic parser. It works with plain text recipes that have "Ingredientes" / "Preparación" sections.

### Optional

```env
# USDA FoodData Central — real nutrition data (free key at fdc.nal.usda.gov/api-key-signup)
USDA_API_KEY=your_key_here

# Cloudinary — image uploads and storage
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# App name shown in the UI
NEXT_PUBLIC_APP_NAME=Mincely
```

---

## Running with Ollama (local AI, no cost)

1. [Install Ollama](https://ollama.com)
2. Pull the recommended models:
   ```bash
   ollama pull qwen2.5:7b
   ollama pull llama3.2-vision:11b   # only needed for image parsing
   ```
3. Set in `.env.local`:
   ```env
   LLM_PROVIDER=ollama
   OLLAMA_MODEL=qwen2.5:7b
   ```

---

## Available Scripts

```bash
pnpm dev          # Start development server (port 3000)
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm test         # Run tests with Vitest
pnpm db:migrate   # Apply SQL migrations to Neon
```

---

## Project Structure

```
app/                    # Next.js App Router pages and API routes
  api/
    process/            # Main recipe parsing endpoint
    recipes/            # CRUD operations
    providers/          # Available LLM providers endpoint
    upload-image/       # Cloudinary upload
    categories/         # Category and ingredient filters
  recipes/[id]/         # Recipe detail + edit pages
components/             # React components
lib/
  extractors/           # One extractor per input type (text, docx, image, youtube)
  llm/                  # LLM abstraction layer (provider.ts, anthropic.ts, openai.ts, ollama.ts)
  nutrition/            # USDA client + quantity parser
  parsers/              # Heuristic parser (no-AI mode)
  schema.ts             # Zod schemas — single source of truth for data model
  process-recipe.ts     # Main AI orchestrator
prompts/
  parse-recipe.md       # System prompt for recipe parsing
migrations/             # SQL migration files
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repository on [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Deploy

> **Note:** Vercel Hobby plan has a 10s timeout. Avoid processing `.docx` files larger than 2 MB on the free tier.

---

## Roadmap

- [ ] User authentication (Better Auth)
- [ ] Observability with Langfuse
- [ ] pgvector semantic recipe search
- [ ] TikTok / Instagram import
- [ ] OpenAI / Ollama in production (currently MVP-only)

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)
