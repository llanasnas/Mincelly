import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { CATEGORIES_BY_TYPE, RECIPE_TYPES, RECIPE_TYPE_LABELS } from '@/lib/categories'

describe('categories', () => {
  it('exposes the supported recipe types in order', () => {
    expect(RECIPE_TYPES).toEqual(['cocina', 'pasteleria', 'bebidas'])
  })

  it('defines a label and a category list for every recipe type', () => {
    for (const type of RECIPE_TYPES) {
      expect(RECIPE_TYPE_LABELS[type]).toBeTruthy()
      expect(CATEGORIES_BY_TYPE[type].length).toBeGreaterThan(0)
    }
  })

  // The catalogue lives in three places — code, SQL seeds and the LLM prompt.
  // A category missing from the database silently drops the link on save, and one
  // missing from the prompt can never be assigned, so the copies must not drift.
  it('matches the categories seeded by the SQL migrations', () => {
    const dir = join(process.cwd(), 'migrations')
    const seeded = new Set<string>()
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      const sql = readFileSync(join(dir, file), 'utf-8')
      // Only the seed statements — CHECK constraints list the types in the same ('a', 'b') shape.
      for (const [insert] of sql.matchAll(/INSERT INTO categories[\s\S]*?;/g)) {
        for (const [, name, type] of insert.matchAll(/\('([^']+)',\s*'(cocina|pasteleria|bebidas)'\)/g)) {
          seeded.add(`${type}:${name}`)
        }
      }
    }

    const inCode = new Set(
      RECIPE_TYPES.flatMap((type) => CATEGORIES_BY_TYPE[type].map((name) => `${type}:${name}`)),
    )
    expect([...inCode].sort()).toEqual([...seeded].sort())
  })

  it('matches the category lists in the system prompt', () => {
    const prompt = readFileSync(join(process.cwd(), 'prompts', 'parse-recipe.md'), 'utf-8')
    const headings = { pasteleria: 'PASTELERÍA', cocina: 'COCINA', bebidas: 'BEBIDAS' } as const

    for (const type of RECIPE_TYPES) {
      const match = prompt.match(new RegExp(`\\*\\*CATEGORÍAS ${headings[type]}\\*\\*[^\\n]*\\n([^\\n]+)`))
      expect(match, `prompt section for ${type}`).not.toBeNull()
      const listed = match![1].split(',').map((c) => c.trim())
      expect(listed.sort()).toEqual([...CATEGORIES_BY_TYPE[type]].sort())
    }
  })
})
