import { REFERENCE_DATA } from './reference-data'
import { foodKey, singularVariants } from './normalize'
import type { ReferenceFood } from './types'

// Connectors carry no meaning for matching: "aceite de girasol" ≡ "aceite girasol".
const dropConnectors = (key: string) =>
  key.replace(/\b(de|del|la|el|los|las|of)\b/g, ' ').replace(/\s+/g, ' ').trim()

const BY_ALIAS = new Map<string, ReferenceFood>()
for (const food of REFERENCE_DATA) {
  for (const alias of food.aliases) BY_ALIAS.set(dropConnectors(alias), food)
}

function lookup(key: string): ReferenceFood | undefined {
  if (!key) return undefined
  for (const variant of singularVariants(dropConnectors(key))) {
    const found = BY_ALIAS.get(variant)
    if (found) return found
  }
  return undefined
}

/**
 * Resolves an ingredient against the bundled USDA snapshot.
 *
 * Matching is exact on purpose: a partial match ("harina de almendra" → "harina")
 * would silently return the wrong food, and a wrong profile is worse than no
 * profile — unmatched names fall through to the live USDA search instead.
 *
 * Each candidate is tried verbatim first so that names containing a
 * modifier-looking word ("pan rallado") win over their stripped form ("pan").
 */
export function findReferenceFood(...names: (string | undefined | null)[]): ReferenceFood | undefined {
  for (const name of names) {
    if (!name) continue
    const found = lookup(foodKey(name, { stripModifiers: false })) ?? lookup(foodKey(name))
    if (found) return found
  }
  return undefined
}
