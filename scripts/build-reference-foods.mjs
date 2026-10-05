// scripts/build-reference-foods.mjs
// Regenerates lib/nutrition/reference-data.ts — a snapshot of per-100 g nutrient
// values for pantry staples, pulled from USDA FoodData Central (SR Legacy).
//
// Each entry pins an explicit fdcId, so the nutrition engine can resolve the most
// common ingredients instantly, deterministically and without a network call.
//
// Usage: pnpm nutrition:build-reference   (requires USDA_API_KEY in .env.local)

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(__dirname, '..', 'lib', 'nutrition', 'reference-data.ts')

const apiKey = process.env.USDA_API_KEY
if (!apiKey) {
  console.error('❌  USDA_API_KEY is not set. Add it to .env.local and run again.')
  process.exit(1)
}

// [fdcId, aliases]. Aliases are matched after normalisation (lowercase, no
// accents, singular), so write them lowercase, unaccented and singular.
// Spanish first, then English.
const FOODS = [
  // ── Fats & oils ────────────────────────────────────────────────────────────
  [171413, ['aceite de oliva', 'aceite', 'aove', 'olive oil', 'oil']],
  [171025, ['aceite de girasol', 'aceite vegetal', 'sunflower oil', 'vegetable oil']],
  [171412, ['aceite de coco', 'coconut oil']],
  [173430, ['mantequilla', 'mantequilla sin sal', 'butter', 'unsalted butter']],
  [173410, ['mantequilla con sal', 'mantequilla salada', 'salted butter']],
  [172346, ['margarina', 'margarine']],
  [171401, ['manteca de cerdo', 'manteca', 'lard']],

  // ── Dairy & eggs ───────────────────────────────────────────────────────────
  [171265, ['leche', 'leche entera', 'milk', 'whole milk']],
  [171267, ['leche semidesnatada', 'semi-skimmed milk', 'reduced fat milk', '2% milk']],
  [171269, ['leche desnatada', 'skim milk', 'skimmed milk', 'nonfat milk']],
  [170876, ['leche en polvo', 'milk powder', 'dry milk', 'powdered milk']],
  [171275, ['leche condensada', 'condensed milk', 'sweetened condensed milk']],
  [172194, ['leche evaporada', 'evaporated milk']],
  [170859, ['nata', 'nata para montar', 'nata liquida', 'nata 35%', 'crema de leche', 'crema para batir', 'heavy cream', 'heavy whipping cream', 'whipping cream', 'double cream', 'cream']],
  [170857, ['nata para cocinar', 'nata ligera', 'light cream', 'cooking cream', 'single cream']],
  [171257, ['nata agria', 'crema agria', 'sour cream']],
  [171284, ['yogur', 'yogur natural', 'yogurt', 'plain yogurt', 'yoghurt']],
  [171304, ['yogur griego', 'greek yogurt']],
  [173418, ['queso crema', 'queso de untar', 'queso philadelphia', 'cream cheese']],
  [170845, ['mozzarella', 'queso mozzarella', 'mozzarella cheese']],
  [170848, ['parmesano', 'queso parmesano', 'parmesan', 'parmesan cheese']],
  [173414, ['cheddar', 'queso cheddar', 'cheddar cheese']],
  [170851, ['ricotta', 'requeson', 'queso ricotta', 'ricotta cheese']],
  [173420, ['feta', 'queso feta', 'feta cheese']],
  [173435, ['queso de cabra', 'rulo de cabra', 'goat cheese']],
  [172175, ['queso azul', 'roquefort', 'blue cheese']],
  [171287, ['huevo', 'huevo entero', 'egg', 'whole egg']],
  [172183, ['clara de huevo', 'clara', 'egg white']],
  [172184, ['yema de huevo', 'yema', 'egg yolk']],

  // ── Grains, flours & starches ──────────────────────────────────────────────
  [168894, ['harina', 'harina de trigo', 'harina comun', 'harina floja', 'harina de reposteria', 'flour', 'wheat flour', 'all-purpose flour', 'all purpose flour', 'plain flour', 'white flour']],
  [168896, ['harina de fuerza', 'harina panadera', 'bread flour', 'strong flour']],
  [168893, ['harina integral', 'harina de trigo integral', 'whole wheat flour', 'wholemeal flour']],
  [169715, ['semola', 'semola de trigo', 'semolina']],
  [169698, ['maicena', 'almidon de maiz', 'fecula de maiz', 'cornstarch', 'corn starch', 'cornflour']],
  [169756, ['arroz', 'arroz blanco', 'arroz redondo', 'arroz bomba', 'rice', 'white rice']],
  [169703, ['arroz integral', 'brown rice']],
  [169736, ['pasta', 'pasta seca', 'macarron', 'espagueti', 'fideo', 'spaghetti', 'macaroni', 'dry pasta']],
  [173904, ['avena', 'copo de avena', 'oat', 'rolled oat', 'oatmeal']],
  [174928, ['pan rallado', 'breadcrumb', 'bread crumb']],
  [174924, ['pan', 'pan blanco', 'pan de molde', 'bread', 'white bread']],
  [169699, ['cuscus', 'couscous']],
  [168874, ['quinoa', 'quinua']],

  // ── Sugars & sweeteners ────────────────────────────────────────────────────
  [169655, ['azucar', 'azucar blanco', 'azucar blanquilla', 'azucar granulado', 'sugar', 'white sugar', 'granulated sugar', 'caster sugar']],
  [168833, ['azucar moreno', 'azucar integral', 'panela', 'brown sugar']],
  [169656, ['azucar glas', 'azucar glace', 'azucar en polvo', 'azucar lustre', 'powdered sugar', 'icing sugar', 'confectioners sugar']],
  [169640, ['miel', 'honey']],
  [169661, ['sirope de arce', 'jarabe de arce', 'maple syrup']],
  [169641, ['mermelada', 'confitura', 'jam', 'preserve']],

  // ── Baking ─────────────────────────────────────────────────────────────────
  [172804, ['levadura quimica', 'levadura en polvo', 'levadura royal', 'polvo de hornear', 'impulsor', 'baking powder']],
  [175040, ['bicarbonato', 'bicarbonato sodico', 'bicarbonato de sodio', 'baking soda']],
  [175043, ['levadura seca', 'levadura seca de panadero', 'levadura de panadero seca', 'dry yeast', 'active dry yeast', 'instant yeast']],
  [175042, ['levadura fresca', 'levadura de panaderia', 'levadura prensada', 'fresh yeast', 'compressed yeast']],
  [169593, ['cacao', 'cacao en polvo', 'cacao puro', 'cacao puro en polvo', 'cocoa', 'cocoa powder', 'unsweetened cocoa powder']],
  [170273, ['chocolate', 'chocolate negro', 'chocolate negro 70%', 'chocolate fondant', 'chocolate de cobertura', 'dark chocolate']],
  [170271, ['chocolate negro 50%', 'chocolate semiamargo', 'semisweet chocolate']],
  [167587, ['chocolate con leche', 'milk chocolate']],
  [167571, ['chocolate blanco', 'white chocolate']],
  [173471, ['extracto de vainilla', 'esencia de vainilla', 'vanilla extract']],
  [169599, ['gelatina', 'gelatina neutra', 'gelatina en polvo', 'hoja de gelatina', 'gelatin', 'gelatine']],
  [170170, ['coco rallado', 'coco', 'desiccated coconut', 'shredded coconut']],
  [170173, ['leche de coco', 'coconut milk']],

  // ── Meat & poultry ─────────────────────────────────────────────────────────
  [171077, ['pollo', 'pechuga de pollo', 'chicken', 'chicken breast']],
  [173627, ['muslo de pollo', 'contramuslo de pollo', 'chicken thigh']],
  [171098, ['pavo', 'pechuga de pavo', 'turkey', 'turkey breast']],
  [171796, ['carne picada', 'carne picada de ternera', 'ternera picada', 'carne molida', 'ground beef', 'minced beef']],
  [170809, ['ternera', 'carne de ternera', 'carne de vacuno', 'vacuno', 'carne para guisar', 'beef', 'stew beef']],
  [168314, ['cerdo', 'carne de cerdo', 'lomo de cerdo', 'pork', 'pork loin']],
  [168277, ['bacon', 'beicon', 'panceta', 'tocino']],
  [173864, ['jamon cocido', 'jamon york', 'jamon dulce', 'ham', 'cooked ham']],
  [173859, ['chorizo', 'chorizo sausage']],
  [174374, ['cordero', 'pierna de cordero', 'lamb', 'leg of lamb']],
  [172410, ['pato', 'duck']],

  // ── Fish & seafood ─────────────────────────────────────────────────────────
  [175167, ['salmon', 'lomo de salmon']],
  [173706, ['atun fresco', 'atun rojo', 'fresh tuna']],
  [173708, ['atun en aceite', 'atun en lata', 'atun en conserva', 'canned tuna', 'tuna in oil']],
  [173709, ['atun al natural', 'tuna in water']],
  [171955, ['bacalao', 'cod']],
  [173713, ['merluza', 'pescadilla', 'hake', 'whiting']],
  [174183, ['anchoa', 'anchovy']],
  [175139, ['sardina en aceite', 'sardina en lata', 'canned sardine']],
  [175179, ['gamba', 'langostino', 'camaron', 'shrimp', 'prawn']],
  [174216, ['mejillon', 'mussel']],
  [174223, ['calamar', 'squid']],

  // ── Vegetables ─────────────────────────────────────────────────────────────
  [170000, ['cebolla', 'onion']],
  [169230, ['ajo', 'diente de ajo', 'garlic', 'garlic clove']],
  [170457, ['tomate', 'tomate rojo', 'tomate de pera', 'tomato']],
  [170501, ['tomate triturado', 'tomate natural triturado', 'tomate en conserva', 'crushed tomato', 'canned tomato']],
  [170054, ['salsa de tomate', 'pure de tomate', 'passata', 'tomato sauce']],
  [170459, ['concentrado de tomate', 'tomate concentrado', 'pasta de tomate', 'tomato paste']],
  [168567, ['tomate seco', 'sun-dried tomato']],
  [170026, ['patata', 'papa', 'potato']],
  [168482, ['boniato', 'batata', 'camote', 'sweet potato']],
  [170393, ['zanahoria', 'carrot']],
  [170108, ['pimiento', 'pimiento rojo', 'bell pepper', 'red bell pepper', 'red pepper']],
  [170427, ['pimiento verde', 'green bell pepper', 'green pepper']],
  [169291, ['calabacin', 'zucchini', 'courgette']],
  [169228, ['berenjena', 'eggplant', 'aubergine']],
  [168409, ['pepino', 'cucumber']],
  [169247, ['lechuga', 'lettuce', 'romaine lettuce']],
  [168462, ['espinaca', 'spinach']],
  [168421, ['kale', 'col rizada']],
  [169251, ['champinon', 'seta', 'mushroom']],
  [169246, ['puerro', 'leek']],
  [169988, ['apio', 'celery']],
  [170379, ['brocoli', 'broccoli']],
  [169986, ['coliflor', 'cauliflower']],
  [169975, ['col', 'repollo', 'cabbage']],
  [168389, ['esparrago', 'esparrago verde', 'asparagus']],
  [170419, ['guisante', 'pea', 'green pea']],
  [169961, ['judia verde', 'green bean']],
  [168448, ['calabaza', 'pumpkin']],
  [169998, ['maiz', 'maiz dulce', 'corn', 'sweet corn']],
  [169231, ['jengibre', 'ginger']],
  [169094, ['aceituna', 'aceituna negra', 'oliva', 'olive']],

  // ── Legumes ────────────────────────────────────────────────────────────────
  [172420, ['lenteja', 'lentil']],
  [173756, ['garbanzo', 'garbanzo seco', 'chickpea', 'dried chickpea']],
  [173800, ['garbanzo cocido', 'garbanzo en conserva', 'garbanzo de bote', 'canned chickpea', 'cooked chickpea']],
  [175202, ['alubia', 'alubia blanca', 'judia blanca', 'white bean']],
  [173734, ['alubia negra', 'frijol negro', 'black bean']],
  [173744, ['alubia roja', 'frijol rojo', 'kidney bean']],
  [172475, ['tofu']],

  // ── Fruit ──────────────────────────────────────────────────────────────────
  [171688, ['manzana', 'apple']],
  [173944, ['platano', 'banana']],
  [169097, ['naranja', 'orange']],
  [169098, ['zumo de naranja', 'jugo de naranja', 'orange juice']],
  [167746, ['limon', 'lemon']],
  [167747, ['zumo de limon', 'jugo de limon', 'lemon juice']],
  [167762, ['fresa', 'freson', 'strawberry']],
  [167755, ['frambuesa', 'raspberry']],
  [171711, ['arandano', 'blueberry']],
  [174683, ['uva', 'grape']],
  [171705, ['aguacate', 'avocado']],
  [169118, ['pera', 'pear']],
  [169928, ['melocoton', 'durazno', 'peach']],
  [169124, ['pina', 'pineapple']],
  [169910, ['mango']],
  [168165, ['pasa', 'uva pasa', 'raisin']],

  // ── Nuts & seeds ───────────────────────────────────────────────────────────
  [170567, ['almendra', 'almendra molida', 'harina de almendra', 'almond', 'ground almond', 'almond flour']],
  [170187, ['nuez', 'walnut']],
  [170581, ['avellana', 'hazelnut']],
  [170184, ['pistacho', 'pistachio']],
  [172430, ['cacahuete', 'mani', 'peanut']],
  [174266, ['mantequilla de cacahuete', 'crema de cacahuete', 'peanut butter']],
  [170591, ['pinon', 'pine nut']],
  [170150, ['sesamo', 'ajonjoli', 'semilla de sesamo', 'sesame seed', 'sesame']],
  [170554, ['chia', 'semilla de chia', 'chia seed']],
  [170562, ['pipa de girasol', 'semilla de girasol', 'sunflower seed']],
  [170556, ['pipa de calabaza', 'semilla de calabaza', 'pumpkin seed']],

  // ── Seasonings & condiments ────────────────────────────────────────────────
  [173468, ['sal', 'sal fina', 'sal marina', 'sal gorda', 'salt', 'table salt', 'sea salt']],
  [170931, ['pimienta', 'pimienta negra', 'pimienta negra molida', 'pepper', 'black pepper', 'ground black pepper']],
  [171329, ['pimenton', 'pimenton dulce', 'paprika', 'sweet paprika']],
  [171320, ['canela', 'canela molida', 'canela en polvo', 'cinnamon', 'ground cinnamon']],
  [170923, ['comino', 'cumin']],
  [171328, ['oregano', 'dried oregano']],
  [170416, ['perejil', 'parsley']],
  [172232, ['albahaca', 'basil']],
  [172237, ['vinagre', 'vinagre de vino', 'vinagre blanco', 'vinegar']],
  [174277, ['salsa de soja', 'soy sauce']],
  [172234, ['mostaza', 'mustard']],
  [171009, ['mayonesa', 'mahonesa', 'mayonnaise']],
  [168556, ['ketchup', 'catsup']],

  // ── Liquids ────────────────────────────────────────────────────────────────
  [173647, ['agua', 'water']],
  [174837, ['vino blanco', 'white wine']],
  [173190, ['vino', 'vino tinto', 'wine', 'red wine']],
  [168746, ['cerveza', 'beer']],
  [172884, ['caldo', 'caldo de pollo', 'broth', 'stock', 'chicken broth', 'chicken stock']],
  [171583, ['caldo de verduras', 'caldo vegetal', 'vegetable broth', 'vegetable stock']],
  [171890, ['cafe', 'coffee', 'brewed coffee']],
]

// USDA nutrient numbers → our profile keys.
const NUTRIENT_NUMBERS = {
  208: 'calories',
  203: 'protein',
  204: 'fat',
  606: 'saturatedFat',
  205: 'carbohydrates',
  269: 'sugar',
  291: 'fiber',
  255: 'water',
  307: 'sodium',
  221: 'alcohol',
}
const KEYS = ['calories', 'protein', 'fat', 'saturatedFat', 'carbohydrates', 'sugar', 'fiber', 'water', 'sodium', 'alcohol']

async function fetchBatch(ids) {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods?api_key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fdcIds: ids,
      format: 'abridged',
      nutrients: Object.keys(NUTRIENT_NUMBERS).map(Number),
    }),
  })
  if (!res.ok) throw new Error(`USDA HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const seenAliases = new Map()
for (const [fdcId, aliases] of FOODS) {
  for (const alias of aliases) {
    if (seenAliases.has(alias)) {
      console.error(`❌  Duplicate alias "${alias}" (fdcId ${seenAliases.get(alias)} and ${fdcId})`)
      process.exit(1)
    }
    seenAliases.set(alias, fdcId)
  }
}

const byId = new Map()
const ids = FOODS.map(([id]) => id)
for (let i = 0; i < ids.length; i += 20) {
  const batch = ids.slice(i, i + 20)
  console.log(`▶  Fetching ${i + 1}–${i + batch.length} of ${ids.length}…`)
  for (const food of await fetchBatch(batch)) byId.set(food.fdcId, food)
}

const entries = []
for (const [fdcId, aliases] of FOODS) {
  const food = byId.get(fdcId)
  if (!food) {
    console.error(`❌  fdcId ${fdcId} (${aliases[0]}) not returned by USDA`)
    process.exit(1)
  }
  const per100g = Object.fromEntries(KEYS.map((k) => [k, null]))
  for (const n of food.foodNutrients ?? []) {
    const number = Number(n.number ?? n.nutrient?.number)
    const key = NUTRIENT_NUMBERS[number]
    const amount = n.amount ?? n.value
    if (key && Number.isFinite(amount)) per100g[key] = Math.round(amount * 100) / 100
  }
  if (per100g.calories === null) {
    console.error(`❌  fdcId ${fdcId} (${food.description}) has no energy value`)
    process.exit(1)
  }
  // Alcohol is only reported when present; treat a missing value as zero.
  per100g.alcohol ??= 0
  entries.push({ fdcId, description: food.description, aliases, per100g })
}

const body = entries
  .map((e) => {
    const profile = KEYS.map((k) => `${k}: ${e.per100g[k]}`).join(', ')
    return [
      '  {',
      `    fdcId: ${e.fdcId},`,
      `    description: ${JSON.stringify(e.description)},`,
      `    aliases: ${JSON.stringify(e.aliases)},`,
      `    per100g: { ${profile} },`,
      '  },',
    ].join('\n')
  })
  .join('\n')

const output = `// AUTO-GENERATED by scripts/build-reference-foods.mjs — do not edit by hand.
// Regenerate with: pnpm nutrition:build-reference
//
// Source: USDA FoodData Central, SR Legacy (public domain / CC0).
// Values are per 100 g of edible portion. calories = kcal, sodium = mg, rest = g.
import type { ReferenceFood } from './types'

export const REFERENCE_DATA: ReferenceFood[] = [
${body}
]
`

writeFileSync(OUT_FILE, output, 'utf-8')
console.log(`\n✅  Wrote ${entries.length} foods to lib/nutrition/reference-data.ts`)
