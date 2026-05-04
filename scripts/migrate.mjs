// scripts/migrate.mjs
// Runs all .sql files in /migrations in order against the Neon database.
// Usage: node scripts/migrate.mjs
//   or:  npm run db:migrate

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
    .filter(f => f.endsWith('.sql'))
    .sort()

if (files.length === 0) {
    console.log('No migration files found.')
    process.exit(0)
}

for (const file of files) {
    const filePath = join(migrationsDir, file)
    const query = readFileSync(filePath, 'utf-8')
    console.log(`▶  Running ${file}…`)
    try {
        // Neon does not support multiple statements in one prepared query.
        // Strip line comments, split on ; and run each statement individually.
        const stripped = query.replace(/--[^\n]*/g, '')
        const statements = stripped
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0)
        for (const stmt of statements) {
            await sql.query(stmt)
        }
        console.log(`✓  ${file} done`)
    } catch (err) {
        console.error(`❌  ${file} failed:`, err.message)
        process.exit(1)
    }
}

console.log('\n✅  All migrations applied.')
