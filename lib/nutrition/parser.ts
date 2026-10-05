import { stripAccents } from './normalize'

// ── Units ────────────────────────────────────────────────────────────────────

// Free-text unit (as written in a recipe, unaccented) → canonical unit.
const UNIT_ALIASES: Record<string, string> = {
  // mass
  g: 'g', gr: 'g', grs: 'g', gram: 'g', grams: 'g', gramo: 'g', gramos: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  kilogramo: 'kg', kilogramos: 'kg',
  mg: 'mg', miligramo: 'mg', miligramos: 'mg',
  oz: 'oz', ounce: 'oz', ounces: 'oz', onza: 'oz', onzas: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', libra: 'lb', libras: 'lb',
  // volume
  ml: 'ml', cc: 'ml', mililitro: 'ml', mililitros: 'ml', milliliter: 'ml', milliliters: 'ml',
  cl: 'cl', centilitro: 'cl', centilitros: 'cl',
  dl: 'dl', decilitro: 'dl', decilitros: 'dl',
  l: 'l', lt: 'l', litro: 'l', litros: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  cup: 'cup', cups: 'cup', taza: 'cup', tazas: 'cup',
  vaso: 'glass', vasos: 'glass', glass: 'glass', glasses: 'glass',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp',
  cucharada: 'tbsp', cucharadas: 'tbsp', cda: 'tbsp', cdas: 'tbsp', 'c/s': 'tbsp',
  'cucharada sopera': 'tbsp', 'cucharadas soperas': 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  cucharadita: 'tsp', cucharaditas: 'tsp', cdta: 'tsp', cdtas: 'tsp', cdita: 'tsp', cditas: 'tsp',
  'c/c': 'tsp',
  chorrito: 'dash', chorro: 'dash', dash: 'dash', splash: 'dash',
  // count-like
  unidad: 'unit', unidades: 'unit', ud: 'unit', uds: 'unit', u: 'unit', unit: 'unit', units: 'unit',
  pieza: 'unit', piezas: 'unit', piece: 'unit', pieces: 'unit',
  clove: 'clove', cloves: 'clove', diente: 'clove', dientes: 'clove',
  slice: 'slice', slices: 'slice', rodaja: 'slice', rodajas: 'slice',
  loncha: 'slice', lonchas: 'slice', rebanada: 'slice', rebanadas: 'slice',
  leaf: 'leaf', leaves: 'leaf', hoja: 'leaf', hojas: 'leaf',
  pizca: 'pinch', pizcas: 'pinch', pinch: 'pinch', pinches: 'pinch',
  punado: 'handful', punados: 'handful', handful: 'handful', handfuls: 'handful',
  ramita: 'sprig', ramitas: 'sprig', rama: 'sprig', ramas: 'sprig', sprig: 'sprig', sprigs: 'sprig',
}

/** Units that read the same in every language — safe to show instead of what the recipe wrote. */
const UNIVERSAL_UNITS = new Set(['g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l'])

const MASS_IN_GRAMS: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, oz: 28.35, lb: 453.6 }

const VOLUME_IN_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, cup: 240, glass: 200, tbsp: 15, tsp: 5, dash: 10,
}

/** Maps a unit as written ("Cucharadas", "gr.", "tazas") to its canonical form, or null if unknown. */
export function canonicalUnit(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = stripAccents(raw).replace(/\./g, '').replace(/\s+/g, ' ').trim()
  return UNIT_ALIASES[key] ?? null
}

// ── Quantity strings ─────────────────────────────────────────────────────────

const VULGAR_FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅛': 1 / 8,
}

function parseSimpleNumber(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (/^\d+(\.\d+)?$/.test(t) || /^\.\d+$/.test(t)) return parseFloat(t)

  const fraction = t.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fraction) {
    const den = Number(fraction[2])
    return den === 0 ? null : Number(fraction[1]) / den
  }

  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const den = Number(mixed[3])
    return den === 0 ? null : Number(mixed[1]) + Number(mixed[2]) / den
  }

  const vulgar = t.match(/^(\d+)?\s*([½⅓⅔¼¾⅛])$/)
  if (vulgar) return Number(vulgar[1] ?? 0) + VULGAR_FRACTIONS[vulgar[2]]

  return null
}

/**
 * Turns a quantity as written into a number: "2", "1.5", "1,5", "1/2", "1 1/2",
 * "½", "1½". Ranges ("2-3", "2 a 3") resolve to their midpoint.
 */
export function parseAmount(value: string | null | undefined): number | null {
  if (!value) return null
  const text = value.trim()
  if (!text) return null

  const range = text.match(/^(.+?)\s*(?:-|–|\ba\b|\bo\b|\bto\b|\bor\b)\s*(.+)$/i)
  if (range) {
    const low = parseSimpleNumber(range[1])
    const high = parseSimpleNumber(range[2])
    if (low !== null && high !== null) return (low + high) / 2
  }

  return parseSimpleNumber(text)
}

const NUMBER_PART = String.raw`[\d.,/½⅓⅔¼¾⅛]+(?:\s+\d+\/\d+)?(?:\s*[-–]\s*[\d.,/]+)?`
const QUANTITY_REGEX = new RegExp(String.raw`^(${NUMBER_PART})\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ./]+)?$`)

/**
 * Multiplies a quantity as written by a factor, for scaling a recipe to a
 * different number of servings: ("1/2", 3) → "1,5". Quantities that can't be
 * read as a number ("al gusto") are returned untouched.
 */
export function scaleQuantity(quantity: string, factor: number): string {
  if (factor === 1) return quantity
  const amount = parseAmount(quantity)
  if (amount === null) return quantity

  const scaled = amount * factor
  // Keep roughly three significant figures: 0,25 · 12,5 · 125
  const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: decimals, useGrouping: false }).format(scaled)
}

/** Splits "1 1/2 tazas de harina" into its leading amount and the rest of the line. */
export function splitLeadingAmount(text: string): { amount: string; rest: string } | null {
  const match = text.trim().match(new RegExp(String.raw`^(${NUMBER_PART})\s*(.*)$`))
  if (!match || parseAmount(match[1]) === null) return null
  return { amount: match[1].trim(), rest: match[2].trim() }
}

type ParsedQuantity = {
  quantity: string
  /** Canonical unit when recognised, otherwise the unit as written (lowercase). */
  unit: string | null
  /** The unit exactly as written, for display. */
  rawUnit: string | null
  original: string
}

/** Splits a quantity that has its unit glued on: "1500 gr" → { quantity: "1500", unit: "g" }. */
export function parseQuantity(value: string | null): ParsedQuantity {
  const original = value ?? ''
  const normalized = original.trim()

  if (!normalized) return { quantity: '', unit: null, rawUnit: null, original }

  const match = normalized.match(QUANTITY_REGEX)
  if (!match) return { quantity: original, unit: null, rawUnit: null, original }

  const [, qtyPart, unitPart] = match
  const quantity = qtyPart.trim()
  if (!unitPart) return { quantity, unit: null, rawUnit: null, original }

  const rawUnit = unitPart.toLowerCase().replace(/\.$/, '')
  return { quantity, unit: canonicalUnit(rawUnit) ?? rawUnit, rawUnit, original }
}

/**
 * The unit to show next to a quantity. Metric units are normalised ("gr" → "g");
 * everything else keeps the recipe's own wording so a Spanish recipe still reads
 * "2 tazas", not "2 cup".
 */
export function displayUnit(parsed: Pick<ParsedQuantity, 'unit' | 'rawUnit'>): string | null {
  if (parsed.unit && UNIVERSAL_UNITS.has(parsed.unit)) return parsed.unit
  return parsed.rawUnit
}

export function parseIngredientQuantity(
  ingredient: { quantity: string | null; unit: string | null },
): { quantity: string; unit: string | null } {
  const { quantity: q, unit: u } = ingredient

  if (u !== null) return { quantity: q ?? '', unit: u }
  if (q === null || q === '') return { quantity: '', unit: null }

  const parsed = parseQuantity(q)
  if (parsed.unit !== null) return { quantity: parsed.quantity, unit: parsed.unit }

  return { quantity: q, unit: null }
}

// ── Densities & unit weights ─────────────────────────────────────────────────

type Rule<T> = { pattern: RegExp; value: T }

// Density in g/ml, used to turn a volume into a weight. Patterns run against the
// unaccented ingredient name; the first match wins, so specific entries go first.
// Word boundaries matter: a bare /sal/ would also match "salsa" and "salmón".
const DENSITIES: Rule<number>[] = [
  { pattern: /\b(aceite|oil)\b/, value: 0.92 },
  { pattern: /\b(miel|honey)\b/, value: 1.42 },
  { pattern: /\b(jarabe|sirope|syrup|melaza|molasses)\b/, value: 1.32 },
  { pattern: /\b(leche condensada|condensed milk)\b/, value: 1.28 },
  { pattern: /\b(leche|milk)\b/, value: 1.03 },
  { pattern: /\b(nata|crema de leche|cream)\b/, value: 1.0 },
  { pattern: /\b(yogur|yogurt|yoghurt)\b/, value: 1.03 },
  { pattern: /\b(salsa de soja|soy sauce)\b/, value: 1.2 },
  { pattern: /\b(tomate|tomato)\b/, value: 1.03 },
  { pattern: /\b(vino|wine|cerveza|beer|vinagre|vinegar)\b/, value: 1.0 },
  { pattern: /\b(azucar gla[cs]e?|azucar en polvo|powdered sugar|icing sugar)\b/, value: 0.5 },
  { pattern: /\b(azucar|sugar)\b/, value: 0.85 },
  { pattern: /\b(maicena|almidon|fecula|cornstarch)\b/, value: 0.54 },
  { pattern: /\b(harina|flour)\b/, value: 0.53 },
  { pattern: /\b(cacao|cocoa)\b/, value: 0.42 },
  { pattern: /\b(avena|oats?)\b/, value: 0.36 },
  { pattern: /\b(pan rallado|breadcrumbs?)\b/, value: 0.45 },
  { pattern: /\b(arroz|rice)\b/, value: 0.85 },
  { pattern: /\b(lentejas?|garbanzos?|alubias?|lentils?|chickpeas?|beans?)\b/, value: 0.8 },
  { pattern: /\b(levadura|polvo de hornear|baking powder|bicarbonato|baking soda)\b/, value: 0.9 },
  { pattern: /\b(sal|salt)\b/, value: 1.2 },
  { pattern: /\b(mantequilla|butter|margarina|margarine)\b/, value: 0.95 },
  { pattern: /\b(queso rallado|parmesano|grated cheese|parmesan)\b/, value: 0.4 },
  { pattern: /\b(agua|water|caldo|broth|stock|zumo|jugo|juice|cafe|coffee)\b/, value: 1.0 },
]

// Weight in grams of one item when a recipe counts instead of weighing
// ("2 huevos", "1 cebolla"). Edible portion, medium size.
const UNIT_WEIGHTS: Rule<number>[] = [
  { pattern: /\b(yema|yolk)\b/, value: 18 },
  { pattern: /\b(clara|egg white)\b/, value: 33 },
  { pattern: /\b(huevos?|eggs?)\b/, value: 55 },
  { pattern: /\b(cabeza de ajo|garlic head)\b/, value: 40 },
  { pattern: /\b(ajos?|garlic)\b/, value: 4 },
  { pattern: /\b(cebolletas?|scallions?|spring onions?)\b/, value: 25 },
  { pattern: /\b(cebollas?|onions?)\b/, value: 150 },
  { pattern: /\b(tomates? cherry|cherry tomato(es)?)\b/, value: 15 },
  { pattern: /\b(tomates?|tomato(es)?)\b/, value: 120 },
  { pattern: /\b(patatas?|papas?|potato(es)?)\b/, value: 170 },
  { pattern: /\b(boniatos?|batatas?|sweet potato(es)?)\b/, value: 200 },
  { pattern: /\b(zanahorias?|carrots?)\b/, value: 70 },
  { pattern: /\b(pimientos?|bell peppers?)\b/, value: 160 },
  { pattern: /\b(calabacin(es)?|zucchinis?|courgettes?)\b/, value: 250 },
  { pattern: /\b(berenjenas?|eggplants?|aubergines?)\b/, value: 300 },
  { pattern: /\b(pepinos?|cucumbers?)\b/, value: 250 },
  { pattern: /\b(puerros?|leeks?)\b/, value: 150 },
  { pattern: /\b(aguacates?|avocados?)\b/, value: 150 },
  { pattern: /\b(manzanas?|apples?)\b/, value: 180 },
  { pattern: /\b(platanos?|bananas?)\b/, value: 120 },
  { pattern: /\b(limon(es)?|lemons?|limas?|limes?)\b/, value: 65 },
  { pattern: /\b(naranjas?|oranges?)\b/, value: 180 },
  { pattern: /\b(peras?|pears?)\b/, value: 170 },
  { pattern: /\b(melocoton(es)?|peach(es)?)\b/, value: 150 },
]

// Weight in grams of one slice / leaf, where it depends on the ingredient.
const SLICE_WEIGHTS: Rule<number>[] = [
  { pattern: /\b(pan|bread)\b/, value: 30 },
  { pattern: /\b(jamon|ham|bacon|beicon|panceta|queso|cheese)\b/, value: 20 },
  { pattern: /\b(limon|lemon|lima|lime|naranja|orange)\b/, value: 8 },
]

const LEAF_WEIGHTS: Rule<number>[] = [
  { pattern: /\b(gelatina|gelatine?)\b/, value: 2 },
  { pattern: /\b(laurel|bay)\b/, value: 0.2 },
  { pattern: /\b(lechuga|lettuce|col|cabbage)\b/, value: 10 },
  { pattern: /\b(albahaca|basil|menta|mint|hierbabuena|salvia|sage)\b/, value: 0.5 },
]

function firstMatch<T>(rules: Rule<T>[], name: string): T | undefined {
  return rules.find((r) => r.pattern.test(name))?.value
}

// ── Quantity → grams ─────────────────────────────────────────────────────────

export interface Measure {
  grams: number
  /** How the weight was derived — decides how much to trust it over an LLM estimate. */
  kind: 'mass' | 'volume' | 'count'
  /**
   * False when the conversion relied on a generic assumption (water density for an
   * unknown liquid, a default slice weight…) rather than ingredient-specific data.
   */
  confident: boolean
}

/**
 * Converts a recipe quantity to grams.
 * Returns null when the quantity can't be read, the unit is unknown, or the
 * ingredient is counted and we have no idea what one of it weighs. Guessing a
 * default there used to turn "1 hoja de laurel" into 100 g.
 */
export function measure(
  quantity: string | null | undefined,
  unit: string | null | undefined,
  ingredientName = '',
): Measure | null {
  let amountText = quantity ?? ''
  let unitText = unit ?? null

  // Unit glued to the quantity ("1500 gr") and no separate unit given.
  if (!unitText && amountText) {
    const parsed = parseQuantity(amountText)
    if (parsed.unit) {
      amountText = parsed.quantity
      unitText = parsed.unit
    }
  }

  const amount = parseAmount(amountText)
  if (amount === null || amount <= 0) return null

  const name = stripAccents(ingredientName)
  const canonical = unitText ? canonicalUnit(unitText) : 'unit'
  if (!canonical) return null

  if (canonical in MASS_IN_GRAMS) {
    return { grams: amount * MASS_IN_GRAMS[canonical], kind: 'mass', confident: true }
  }

  if (canonical in VOLUME_IN_ML) {
    const density = firstMatch(DENSITIES, name)
    return {
      grams: amount * VOLUME_IN_ML[canonical] * (density ?? 1),
      kind: 'volume',
      confident: density !== undefined && canonical !== 'dash',
    }
  }

  const count = (perItem: number | undefined, fallback?: number): Measure | null => {
    const weight = perItem ?? fallback
    if (weight === undefined) return null
    return { grams: amount * weight, kind: 'count', confident: perItem !== undefined }
  }

  switch (canonical) {
    case 'unit': return count(firstMatch(UNIT_WEIGHTS, name))
    case 'clove': return count(4)
    case 'slice': return count(firstMatch(SLICE_WEIGHTS, name), 25)
    case 'leaf': return count(firstMatch(LEAF_WEIGHTS, name), 1)
    case 'pinch': return count(0.4)
    case 'handful': return count(undefined, 30)
    case 'sprig': return count(undefined, 2)
    default: return null
  }
}

/** Convenience wrapper around {@link measure} for callers that only need the weight. */
export function gramsFromQuantity(
  quantity: string | null,
  unit: string | null,
  ingredientName = '',
): number | null {
  return measure(quantity, unit, ingredientName)?.grams ?? null
}
