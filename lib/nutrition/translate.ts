import { foodKey, stripAccents } from './normalize'

// Spanish → English dictionary for common recipe ingredients. USDA FoodData
// Central only indexes English names, so this is the fallback translation when
// the LLM did not provide one (non-AI mode, or a manually edited ingredient).
// Not exhaustive — unknown words pass through untouched.
const TERMS: Record<string, string> = {
  // Aceites / grasas
  'aceite de oliva': 'olive oil',
  'aceite de girasol': 'sunflower oil',
  'aceite vegetal': 'vegetable oil',
  'aceite': 'oil',
  'mantequilla': 'butter',
  'manteca': 'lard',
  'nata': 'cream',
  'crema': 'cream',
  'margarina': 'margarine',

  // Lácteos
  'leche': 'milk',
  'leche entera': 'whole milk',
  'leche desnatada': 'skim milk',
  'yogur': 'yogurt',
  'yogurt': 'yogurt',
  'queso': 'cheese',
  'queso parmesano': 'parmesan cheese',
  'queso mozzarella': 'mozzarella cheese',
  'queso cheddar': 'cheddar cheese',
  'requesón': 'ricotta cheese',
  'huevo': 'egg',
  'huevos': 'egg',
  'clara': 'egg white',
  'yema': 'egg yolk',

  // Harinas, granos, panes
  'harina': 'flour',
  'harina de trigo': 'wheat flour',
  'harina integral': 'whole wheat flour',
  'pan': 'bread',
  'pan rallado': 'breadcrumbs',
  'arroz': 'rice',
  'pasta': 'pasta',
  'avena': 'oats',
  'maíz': 'corn',
  'maicena': 'cornstarch',
  'cuscús': 'couscous',
  'quinoa': 'quinoa',

  // Endulzantes
  'azúcar': 'sugar',
  'azucar': 'sugar',
  'azúcar moreno': 'brown sugar',
  'miel': 'honey',
  'panela': 'panela',
  'sirope': 'syrup',

  // Carnes / pescados
  'pollo': 'chicken',
  'pechuga de pollo': 'chicken breast',
  'muslo de pollo': 'chicken thigh',
  'ternera': 'beef',
  'vaca': 'beef',
  'cerdo': 'pork',
  'cordero': 'lamb',
  'carne picada': 'ground beef',
  'jamón': 'ham',
  'jamon': 'ham',
  'jamón serrano': 'serrano ham',
  'bacon': 'bacon',
  'panceta': 'pancetta',
  'chorizo': 'chorizo sausage',
  'salchicha': 'sausage',
  'pescado': 'fish',
  'salmón': 'salmon',
  'atún': 'tuna',
  'merluza': 'hake',
  'bacalao': 'cod',
  'gamba': 'shrimp',
  'gambas': 'shrimp',
  'langostino': 'shrimp',
  'mejillón': 'mussel',
  'mejillones': 'mussel',
  'calamar': 'squid',
  'pulpo': 'octopus',

  // Verduras
  'tomate': 'tomato',
  'tomate triturado': 'crushed tomato',
  'tomate frito': 'tomato sauce',
  'cebolla': 'onion',
  'ajo': 'garlic',
  'pimiento': 'bell pepper',
  'pimiento rojo': 'red bell pepper',
  'pimiento verde': 'green bell pepper',
  'patata': 'potato',
  'patatas': 'potato',
  'papa': 'potato',
  'zanahoria': 'carrot',
  'calabacín': 'zucchini',
  'calabaza': 'pumpkin',
  'berenjena': 'eggplant',
  'lechuga': 'lettuce',
  'espinaca': 'spinach',
  'espinacas': 'spinach',
  'champiñón': 'mushroom',
  'champiñones': 'mushroom',
  'seta': 'mushroom',
  'setas': 'mushroom',
  'pepino': 'cucumber',
  'apio': 'celery',
  'puerro': 'leek',
  'brócoli': 'broccoli',
  'coliflor': 'cauliflower',
  'col': 'cabbage',
  'guisante': 'pea',
  'guisantes': 'pea',
  'judía verde': 'green bean',
  'judías verdes': 'green bean',
  'lenteja': 'lentil',
  'lentejas': 'lentil',
  'garbanzo': 'chickpea',
  'garbanzos': 'chickpea',
  'alubia': 'bean',
  'alubias': 'bean',
  'frijol': 'bean',
  'frijoles': 'bean',
  'habas': 'fava bean',

  // Frutas
  'manzana': 'apple',
  'plátano': 'banana',
  'banana': 'banana',
  'naranja': 'orange',
  'limón': 'lemon',
  'lima': 'lime',
  'fresa': 'strawberry',
  'fresas': 'strawberry',
  'uva': 'grape',
  'uvas': 'grape',
  'pera': 'pear',
  'melocotón': 'peach',
  'piña': 'pineapple',
  'sandía': 'watermelon',
  'melón': 'melon',
  'aguacate': 'avocado',

  // Frutos secos
  'almendra': 'almond',
  'almendras': 'almond',
  'nuez': 'walnut',
  'nueces': 'walnut',
  'avellana': 'hazelnut',
  'avellanas': 'hazelnut',
  'pistacho': 'pistachio',
  'pistachos': 'pistachio',
  'cacahuete': 'peanut',
  'cacahuetes': 'peanut',
  'pipa': 'sunflower seed',
  'pipas': 'sunflower seed',

  // Especias / condimentos
  'sal': 'salt',
  'pimienta': 'pepper',
  'pimentón': 'paprika',
  'pimentón dulce': 'sweet paprika',
  'pimentón picante': 'hot paprika',
  'comino': 'cumin',
  'orégano': 'oregano',
  'tomillo': 'thyme',
  'romero': 'rosemary',
  'albahaca': 'basil',
  'perejil': 'parsley',
  'cilantro': 'cilantro',
  'laurel': 'bay leaf',
  'azafrán': 'saffron',
  'curry': 'curry powder',
  'canela': 'cinnamon',
  'jengibre': 'ginger',
  'nuez moscada': 'nutmeg',
  'mostaza': 'mustard',
  'vinagre': 'vinegar',
  'vinagre de manzana': 'apple vinegar',
  'salsa de soja': 'soy sauce',
  'mayonesa': 'mayonnaise',
  'kétchup': 'ketchup',

  // Bebidas
  'agua': 'water',
  'vino': 'wine',
  'vino blanco': 'white wine',
  'vino tinto': 'red wine',
  'cerveza': 'beer',
  'café': 'coffee',
  'té': 'tea',
  'caldo': 'broth',
  'caldo de pollo': 'chicken broth',
  'caldo de verduras': 'vegetable broth',

  // Cacao / chocolate
  'chocolate': 'chocolate',
  'cacao': 'cocoa',
  'cacao en polvo': 'cocoa powder',

  // Varios
  'zumo': 'juice',
  'jugo': 'juice',
  'jarabe': 'syrup',
  'ralladura': 'zest',
  'girasol': 'sunflower',
  'salsa': 'sauce',
  'puré': 'puree',
  'semilla': 'seed',
  'semillas': 'seed',
  'coco': 'coconut',
  'vainilla': 'vanilla',
  'levadura': 'yeast',
  'gelatina': 'gelatin',
  'pavo': 'turkey',
  'conejo': 'rabbit',
  'pato': 'duck',
  'espárrago': 'asparagus',
  'espárragos': 'asparagus',
  'alcachofa': 'artichoke',
  'alcachofas': 'artichoke',
  'remolacha': 'beet',
  'acelga': 'chard',
  'acelgas': 'chard',
  'boniato': 'sweet potato',
  'ron': 'rum',
  'coñac': 'cognac',
  'queso fresco': 'fresh cheese',
  'queso de cabra': 'goat cheese',
}

const DICTIONARY = new Map(Object.entries(TERMS).map(([es, en]) => [stripAccents(es), en]))

/** Lookup key for an ingredient name — see `foodKey`. */
export function normalizeForLookup(name: string): string {
  return foodKey(name)
}

/** A phrase the dictionary knows as a whole, or as an "X de Y" compound. */
function translatePhrase(key: string): string | undefined {
  const whole = DICTIONARY.get(key)
  if (whole) return whole

  // "X de Y": English puts the qualifier first. Only when both halves are known —
  // translating just the head would turn almond flour into plain flour.
  const compound = key.match(/^(.+?) de (.+)$/)
  if (!compound) return undefined
  const head = DICTIONARY.get(compound[1])
  const qualifier = DICTIONARY.get(compound[2])
  return head && qualifier ? `${qualifier} ${head}` : undefined
}

/**
 * Best-effort English name for an ingredient, suitable as a USDA search query.
 *
 *  1. Whole phrase:        "aceite de oliva"        → "olive oil"
 *  2. "X de Y" compounds:  "harina de almendra"     → "almond flour"
 *  3. Leading phrase:      "harina de trigo blanca" → "wheat flour"
 *  4. Word by word, leaving unknown words as they are.
 */
export function translateIngredient(name: string): string {
  const key = foodKey(name)
  if (!key) return name

  const phrase = translatePhrase(key)
  if (phrase) return phrase

  // Longest known leading phrase, as long as what we drop is a plain descriptor
  // ("… tostada") and not a "de …" complement that changes which food this is.
  const words = key.split(' ')
  for (let len = words.length - 1; len > 0; len--) {
    if (words[len] === 'de') continue
    const leading = translatePhrase(words.slice(0, len).join(' '))
    if (leading) return leading
  }

  return words
    .filter((w) => w !== 'de')
    .map((w) => DICTIONARY.get(w) ?? w)
    .join(' ')
}

