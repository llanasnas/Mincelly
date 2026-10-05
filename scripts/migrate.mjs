// scripts/migrate.mjs
// Applies the .sql files in /migrations, in order, to the Neon database.
// Each migration runs once: applied files are recorded in `schema_migrations`.
//
// Usage: pnpm db:migrate   (reads DATABASE_URL from .env.local)

import { neon } from '@neondatabase/serverless'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const url = process.env.DATABASE_URL
if (!url) {
  console.error('❌  DATABASE_URL is not set. Add it to .env.local and run again.')
  process.exit(1)
}

const sql = neon(url)
const migrationsDir = join(__dirname, '..', 'migrations')

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  console.log('No migration files found.')
  process.exit(0)
}

await sql.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)
const applied = new Set((await sql.query('SELECT filename FROM schema_migrations')).map((r) => r.filename))

// Databases created before migrations were tracked have no records yet. Every
// migration up to that point is idempotent, so running them once more is safe
// and simply brings the bookkeeping up to date.
let ran = 0
for (const file of files) {
  if (applied.has(file)) {
    console.log(`–  ${file} already applied`)
    continue
  }

  console.log(`▶  Running ${file}…`)
  try {
    // Neon's HTTP driver takes one statement per call: strip line comments,
    // split on ";" and run the statements one by one.
    const statements = readFileSync(join(migrationsDir, file), 'utf-8')
      .replace(/--[^\n]*/g, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const statement of statements) {
      await sql.query(statement)
    }
    await sql.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
    console.log(`✓  ${file} done`)
    ran++
  } catch (err) {
    console.error(`❌  ${file} failed:`, err.message)
    process.exit(1)
  }
}

console.log(ran > 0 ? `\n✅  Applied ${ran} migration(s).` : '\n✅  Database is up to date.')
