const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gr: 'g',
  gram: 'g',
  gramos: 'g',
  kg: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
  ml: 'ml',
  mililitro: 'ml',
  mililitros: 'ml',
  l: 'l',
  litro: 'l',
  litros: 'l',
  cup: 'cup',
  cups: 'cup',
  taza: 'cup',
  tazas: 'cup',
  tablespoon: 'tbsp',
  tbsp: 'tbsp',
  cucharadas: 'tbsp',
  teaspoon: 'tsp',
  tsp: 'tsp',
  cdta: 'tsp',
  cdtas: 'tsp',
  oz: 'oz',
  ounce: 'oz',
  onza: 'oz',
  onzas: 'oz',
  lb: 'lb',
  lbs: 'lb',
  libra: 'lb',
  libras: 'lb',
  unidad: 'unit',
  unidades: 'unit',
  unit: 'unit',
  units: 'unit',
  pieza: 'unit',
  piezas: 'unit',
  clove: 'clove',
  dientes: 'clove',
  rodaja: 'slice',
  rodajas: 'slice',
  slice: 'slice',
  slices: 'slice',
  hoja: 'leaf',
  hojas: 'leaf',
  leaf: 'leaf',
}

const QUANTITY_REGEX = /^([\d./]+(?:\s*[-+/]\s*[\d./]+)?)\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)?$/i

type ParsedQuantity = {
  quantity: string
  unit: string | null
  original: string
}

export function parseQuantity(value: string | null): ParsedQuantity {
  const original = value ?? ''

  if (!original.trim()) {
    return { quantity: '', unit: null, original }
  }

  const normalized = original.trim()

  const match = normalized.match(QUANTITY_REGEX)

  if (!match) {
    if (/^[\d./]+$/.test(normalized)) {
      return { quantity: normalized, unit: null, original }
    }
    return { quantity: original, unit: null, original }
  }

  const [, qtyPart, unitPart] = match
  const quantity = qtyPart.trim()

  if (!unitPart) {
    return { quantity, unit: null, original }
  }

  const unitLower = unitPart.toLowerCase()
  const unit = UNIT_ALIASES[unitLower] ?? unitLower

  return { quantity, unit, original }
}

export function parseIngredientQuantity(
  ingredient: { quantity: string | null; unit: string | null }
): { quantity: string; unit: string | null } {
  const { quantity: q, unit: u } = ingredient

  if (u !== null) {
    return { quantity: q ?? '', unit: u }
  }

  if (q === null || q === '') {
    return { quantity: '', unit: null }
  }

  const parsed = parseQuantity(q)

  if (parsed.unit !== null) {
    return {
      quantity: parsed.quantity,
      unit: parsed.unit,
    }
  }

  return { quantity: q ?? '', unit: null }
}

// Density (g/ml) for common ingredients. Used to convert volume → mass accurately.
// Default 1.0 g/ml when ingredient name doesn't match.
const DENSITIES: Array<{ pattern: RegExp; density: number }> = [
  { pattern: /aceite|oil/i, density: 0.92 },
  { pattern: /miel|honey/i, density: 1.42 },
  { pattern: /jarabe|sirope|syrup|melaza|molasses/i, density: 1.32 },
  { pattern: /leche|milk/i, density: 1.03 },
  { pattern: /nata|crema|cream/i, density: 1.00 },
  { pattern: /yogur|yogurt/i, density: 1.05 },
  { pattern: /vino|wine/i, density: 0.99 },
  { pattern: /vinagre|vinegar/i, density: 1.01 },
  { pattern: /salsa de soja|soy sauce/i, density: 1.20 },
  { pattern: /azúcar|azucar|sugar/i, density: 0.85 },
  { pattern: /harina|flour/i, density: 0.55 },
  { pattern: /sal|salt/i, density: 1.20 },
  { pattern: /mantequilla|butter/i, density: 0.91 },
  { pattern: /agua|water|caldo|broth|stock/i, density: 1.00 },
]

function densityFor(ingredientName: string): number {
  for (const { pattern, density } of DENSITIES) {
    if (pattern.test(ingredientName)) return density
  }
  return 1.0
}

// Approximate gram weight for "1 unit" of common ingredients (when no unit given).
const UNIT_WEIGHTS: Array<{ pattern: RegExp; grams: number }> = [
  { pattern: /huevo|egg/i, grams: 60 },
  { pattern: /cebolla|onion/i, grams: 150 },
  { pattern: /ajo|garlic/i, grams: 5 },     // diente de ajo
  { pattern: /tomate|tomato/i, grams: 120 },
  { pattern: /patata|papa|potato/i, grams: 200 },
  { pattern: /zanahoria|carrot/i, grams: 80 },
  { pattern: /manzana|apple/i, grams: 180 },
  { pattern: /plátano|banana/i, grams: 120 },
  { pattern: /limón|lemon/i, grams: 80 },
  { pattern: /naranja|orange/i, grams: 200 },
  { pattern: /pimiento|pepper/i, grams: 150 },
]

function unitWeightFor(ingredientName: string): number {
  for (const { pattern, grams } of UNIT_WEIGHTS) {
    if (pattern.test(ingredientName)) return grams
  }
  return 100
}

export function gramsFromQuantity(
  quantity: string | null,
  unit: string | null,
  ingredientName: string = ''
): number | null {
  const { quantity: q, unit: u } = parseIngredientQuantity({ quantity, unit })

  if (!q) return null

  const numQty = parseFraction(q)
  if (numQty === null) return null

  if (u === null) {
    // No unit → treat as count of items, use ingredient-specific weight
    return numQty * unitWeightFor(ingredientName)
  }

  const density = densityFor(ingredientName)

  const conversionToGrams: Record<string, (v: number) => number> = {
    g: (v) => v,
    kg: (v) => v * 1000,
    ml: (v) => v * density,
    l: (v) => v * 1000 * density,
    cup: (v) => v * 240 * density,
    tbsp: (v) => v * 15 * density,
    tsp: (v) => v * 5 * density,
    oz: (v) => v * 28.35,
    lb: (v) => v * 453.6,
    unit: (v) => v * unitWeightFor(ingredientName),
    clove: (v) => v * 5,
    slice: (v) => v * 30,
    leaf: (v) => v * 2,
  }

  const converter = conversionToGrams[u]
  if (!converter) return null

  return converter(numQty)
}

function parseFraction(value: string): number | null {
  const trimmed = value.trim()

  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10)
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [num, den] = trimmed.split('/').map(Number)
    return num / den
  }

  if (/^\d+\s*\d+\/\d+$/.test(trimmed)) {
    const match = trimmed.match(/^(\d+)\s*(\d+)\/(\d+)$/)
    if (!match) return null
    const [, whole, num, den] = match
    return parseInt(whole, 10) + parseInt(num, 10) / parseInt(den, 10)
  }

  if (/^\d*\.?\d+$/.test(trimmed)) {
    return parseFloat(trimmed)
  }

  return null
}