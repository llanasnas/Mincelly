// Minimal ES→EN map for common recipe ingredients. USDA API only matches English.
// Not exhaustive — falls back to original text on miss.
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
}

// Modifiers we strip before lookup so "tomate fresco picado" → "tomate"
const MODIFIERS = /\b(fresco|frescos|fresca|frescas|congelado|congelada|congelados|congeladas|seco|seca|secos|secas|maduro|madura|crudo|cruda|cocido|cocida|hervido|hervida|asado|asada|al horno|frito|frita|picado|picada|rallado|rallada|laminado|laminada|cortado|cortada|en rodajas|en cubos|en dados|en juliana|sin piel|sin hueso|sin sal|al gusto|opcional|natural|en lata|enlatado|enlatada|concentrado|concentrada|extra virgen|virgen|integral)\b/gi

export function normalizeForLookup(name: string): string {
  return name.toLowerCase().replace(MODIFIERS, '').replace(/\s+/g, ' ').trim()
}

export function translateIngredient(name: string): string {
  const normalized = normalizeForLookup(name)
  if (!normalized) return name

  // Whole-phrase match first
  if (TERMS[normalized]) return TERMS[normalized]

  // Try removing trailing words (e.g. "harina de trigo blanca" → "harina de trigo" → "harina")
  const words = normalized.split(' ')
  for (let len = words.length; len > 0; len--) {
    const phrase = words.slice(0, len).join(' ')
    if (TERMS[phrase]) return TERMS[phrase]
  }

  // Word-by-word fallback
  const translated = words.map((w) => TERMS[w] ?? w).join(' ')
  return translated
}
