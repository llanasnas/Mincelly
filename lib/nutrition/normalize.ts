/** Lowercases and removes diacritics: "Azúcar Glacé" → "azucar glace". */
export function stripAccents(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Descriptors that change how an ingredient is cut or served but NOT what it is
// made of, so they are safe to drop before a database lookup.
//
// Deliberately absent: "seco", "cocido", "frito", "integral", "en lata",
// "concentrado", "rallado"… — those describe a different food ("tomate seco",
// "garbanzo cocido", "harina integral", "pan rallado") with a different profile.
const SAFE_MODIFIERS = new RegExp(
  '\\b(' +
    [
      'frescos?', 'frescas?', 'maduros?', 'maduras?', 'crudos?', 'crudas?',
      'picados?', 'picadas?', 'troceados?', 'troceadas?', 'cortados?', 'cortadas?',
      'laminados?', 'laminadas?', 'pelados?', 'peladas?', 'limpios?', 'limpias?',
      'tamizados?', 'tamizadas?', 'derretidos?', 'derretidas?', 'fundidos?', 'fundidas?',
      'batidos?', 'batidas?', 'grandes?', 'medianos?', 'medianas?', 'pequenos?', 'pequenas?',
      'en rodajas', 'en cubos', 'en dados', 'en juliana', 'en trozos', 'en tiras', 'en brunoise',
      'sin piel', 'sin hueso', 'sin pepitas', 'sin semillas',
      'al gusto', 'opcional', 'a temperatura ambiente', 'del tiempo',
      'virgen extra', 'extra virgen', 'virgen',
      'fresh', 'ripe', 'raw', 'chopped', 'diced', 'sliced', 'minced', 'peeled', 'melted',
      'sifted', 'large', 'medium', 'small', 'to taste', 'optional', 'extra virgin',
    ].join('|') +
    ')\\b',
  'g',
)

/**
 * Canonical lookup key for an ingredient name: lowercase, unaccented, without
 * punctuation and (optionally) without composition-neutral descriptors.
 */
export function foodKey(name: string, { stripModifiers = true } = {}): string {
  let key = stripAccents(name)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9%\s-]/g, ' ')
  if (stripModifiers) key = key.replace(SAFE_MODIFIERS, ' ')
  return key.replace(/\s+/g, ' ').trim()
}

/**
 * Plural-insensitive variants of a key. Spanish and English plurals can't be
 * undone reliably by rule ("tomates" → "tomate", but "limones" → "limon"), so we
 * generate the plausible singulars and let the caller try each one.
 */
export function singularVariants(key: string): string[] {
  const words = key.split(' ')
  const dropS = words.map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
  const dropEs = words.map((w) => {
    if (w.length > 4 && w.endsWith('ces')) return `${w.slice(0, -3)}z` // nueces → nuez
    if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y` // berries → berry
    if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2) // limones → limon
    if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1)
    return w
  })
  return [...new Set([key, dropS.join(' '), dropEs.join(' ')])]
}
