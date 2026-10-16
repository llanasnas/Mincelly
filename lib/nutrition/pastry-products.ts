// Professional pastry and kitchen products that USDA does not list under the names a
// Spanish pastry chef uses: couverture chocolates by brand, technical sugars, gelling
// agents, emulsifiers, stabilisers and colourings.
//
// Values are per 100 g, taken from manufacturer specification sheets (Valrhona, Cacao
// Barry, Sosa, generic supplier data) and rounded; sodium in mg, everything else in g.
// They sit between the USDA snapshot and the live USDA search: exact-name matches only,
// so "chocolate" still goes to USDA and only "manjari 64%" lands here.
import { foodKey, singularVariants } from './normalize'
import type { NutrientProfile } from './types'

export interface PastryProduct {
  description: string
  aliases: string[]
  per100g: NutrientProfile
}

type Num = number
const p = (
  calories: Num,
  protein: Num,
  fat: Num,
  saturatedFat: Num,
  carbohydrates: Num,
  sugar: Num,
  fiber: Num,
  water: Num,
  sodium = 0,
  alcohol = 0,
): NutrientProfile => ({ calories, protein, fat, saturatedFat, carbohydrates, sugar, fiber, water, sodium, alcohol })

const WHITE = p(557, 7, 36, 22, 53, 53, 0, 1, 100)
const MILK = p(557, 7.4, 36, 22, 50, 45, 2, 1, 100)
const DARK60 = p(560, 6, 37, 23, 45, 40, 7, 1, 20)
const DARK70 = p(580, 8.6, 43, 26, 32, 28, 11, 1, 10)
const ZERO = p(0, 0, 0, 0, 0, 0, 0, 0)
const POLYOL = p(240, 0, 0, 0, 100, 0, 0, 0)
const GUM = p(20, 1, 0, 0, 75, 0, 75, 10)
const CREAM = p(340, 2.1, 36, 23, 2.8, 2.8, 0, 58, 38)

export const PASTRY_PRODUCTS: PastryProduct[] = [
  // ── couverture chocolate ───────────────────────────────────────────────
  { description: 'Cobertura blanca 35% (Valrhona Ivoire)', aliases: ['ivoire', 'ivoire 35', 'ivoire 35%', 'chocolate ivoire', 'opalys', 'opalys 33', 'opalys 33%', 'cobertura blanca', 'cobertura de chocolate blanco', 'xoco blanco', 'choco blanco', 'chocolate blanco cobertura', 'zephyr', 'zephyr 34%'], per100g: WHITE },
  { description: 'Cobertura con leche 40% (Valrhona Jivara)', aliases: ['jivara', 'jivara 40', 'jivara 40%', 'jivara leche', 'jivara lactee', 'cobertura leche', 'cobertura de leche', 'cobertura con leche', 'xoco leche', 'choco leche', 'chocolate leche cobertura', 'tanariva', 'tanariva 33%', 'bahibe', 'bahibe 46%', 'satilia leche', 'satilia lait', 'tropilia leche', 'tropilia lait', 'lactee superieure', 'lactee superieure 38%'], per100g: MILK },
  { description: 'Cobertura caramelizada (Valrhona Caramelia / Dulcey)', aliases: ['caramelia', 'caramelia 36', 'caramelia 36%', 'dulcey', 'dulcey 32', 'dulcey 32%', 'dulcey 35', 'dulcey 35%', 'chocolate rubio', 'chocolate blond'], per100g: p(558, 6, 36, 22, 53, 50, 1, 1, 150) },
  { description: 'Cobertura negra 64% (Valrhona Manjari)', aliases: ['manjari', 'manjari 64', 'manjari 64%', 'manjari 65', 'manjari 65%', 'satilia', 'satilia negra', 'satilia noire', 'satilia 62', 'satilia 62%', 'cobertura negra 62%', 'cobertura negra 64%', 'cobertura 64%', 'chocolate 64%', 'chocolate 64', 'chocolate negro 64%', 'equatoriale', 'equatoriale 55%'], per100g: p(573, 7, 41, 25, 40, 34, 8, 1, 10) },
  { description: 'Cobertura negra 66% (Valrhona Caraibe)', aliases: ['caraibe', 'caraibe 66', 'caraibe 66%', 'chocolate 66%', 'cobertura 66%', 'cobertura negra 66%'], per100g: p(580, 7, 42, 26, 37, 32, 9, 1, 10) },
  { description: 'Cobertura negra 70% (Valrhona Guanaja)', aliases: ['guanaja', 'guanaja 70', 'guanaja 70%', 'tropilia', 'tropilia amer', 'tropilia 70', 'tropilia 70%', 'cobertura negra', 'cobertura negra 70', 'cobertura negra 70%', 'cobertura 70', 'cobertura 70%', 'cobertura chocolate negro', 'cobertura de chocolate negro', 'chocolate negro 70',  'chocolate 70', 'chocolate 70%', 'chocolate 72', 'chocolate 72%', 'cobertura 72%', 'cobertura negra 72%', 'xoco negro', 'choco negro'], per100g: DARK70 },
  { description: 'Cobertura negra 72–85% (Valrhona Araguani / Abinao)', aliases: ['araguani', 'araguani 72', 'araguani 72%', 'abinao', 'abinao 85', 'abinao 85%', 'chocolate 85%', 'chocolate 80%', 'cobertura 85%'], per100g: p(595, 10, 46, 28, 26, 20, 14, 1, 10) },
  { description: 'Cobertura de chocolate negro (genérica, ~60%)', aliases: ['cobertura', 'cobertura de chocolate', 'cobertura chocolate',   'chocolate 60%', 'cobertura 60%', 'drops de chocolate', 'drops', 'gotas de chocolate', 'chocolate en gotas', 'pepitas de chocolate'], per100g: DARK60 },
  { description: 'Chocolate negro sin azúcar 61% con maltitol (Valrhona Xocoline)', aliases: ['xocoline', 'xocoline 61', 'xocoline 61%', 'xocoline negro', 'chocolate sin azucar', 'chocolate negro sin azucar', 'cobertura sin azucar'], per100g: p(520, 8, 40, 24, 42, 1, 10, 1, 20) },
  { description: 'Chocolate con leche sin azúcar 41% (Valrhona Xocoline Lait)', aliases: ['xocoline 41', 'xocoline 41%', 'xocoline leche', 'xocoline lacteo', 'xocoline lait', 'chocolate con leche sin azucar'], per100g: p(520, 7, 39, 24, 45, 5, 5, 1, 100) },
  { description: 'Cobertura de fruta / fruto seco (Valrhona Inspiration)', aliases: ['inspiracion', 'inspiration', 'inspiracion frambuesa', 'inspiracion fresa', 'inspiracion pasion', 'inspiracion almendra', 'inspiracion yuzu', 'inspiration framboise', 'inspiration passion', 'inspiration amande', 'inspiration fraise', 'inspiration yuzu'], per100g: p(560, 4, 36, 22, 55, 48, 1, 1, 50) },
  { description: 'Manteca de cacao', aliases: ['manteca de cacao', 'manteca cacao', 'cocoa butter', 'mycryo', 'manteca de cacao en polvo', 'manteca de cacao mycryo'], per100g: p(884, 0, 100, 60, 0, 0, 0, 0) },
  { description: 'Pasta de cacao 100%', aliases: ['pasta de cacao', 'masa de cacao', 'cacao 100', 'cacao 100%', 'chocolate 100', 'chocolate 100%', 'licor de cacao', 'pasta de cacao 100%'], per100g: p(598, 13, 53, 32, 30, 0, 17, 1, 20) },
  { description: 'Gianduja (chocolate con avellana)', aliases: ['gianduja', 'gianduia', 'gianduja avellana', 'gianduja de avellana', 'gianduja leche', 'gianduja negro'], per100g: p(540, 7, 32, 14, 55, 50, 3, 1, 50) },
  { description: 'Praliné de frutos secos 50%', aliases: ['praline', 'pralin', 'praline avellana', 'praline de avellana', 'praline de avellanas', 'praline noisette', 'praline noisettes', 'praline 50', 'praline 50%', 'praline 60%', 'praline almendra', 'praline de almendra', 'praline amande', 'praline pistacho', 'praline de pistacho', 'praline almendra avellana', 'praline noisette 50%'], per100g: p(540, 8, 32, 3, 52, 48, 4, 1, 10) },
  { description: 'Pasta de pistacho 100%', aliases: ['pasta de pistacho', 'pasta pistacho', 'pasta pistacho verde', 'pasta de pistacho verde', 'pure de pistacho', 'pistacho en pasta', 'pasta de pistacho pura'], per100g: p(580, 20, 46, 6, 25, 8, 10, 2, 10) },
  { description: 'Pasta de avellana 100%', aliases: ['pasta de avellana', 'pasta avellana', 'pasta de avellanas', 'pasta avellanas', 'pure de avellana', 'avellana en pasta'], per100g: p(650, 14, 62, 4.5, 17, 4, 10, 2) },
  { description: 'Pasta de almendra 100%', aliases: ['pasta de almendra', 'pasta almendra', 'pasta de almendras', 'pure de almendra', 'almendra en pasta'], per100g: p(600, 21, 52, 4, 20, 4, 11, 2) },
  { description: 'Tant pour tant (almendra y azúcar a partes iguales)', aliases: ['tpt', 'tant pour tant', 'tanto por tanto', 'tpt almendra', 'tpt de almendra'], per100g: p(480, 11, 26, 2, 56, 52, 5, 3) },
  { description: 'Mazapán', aliases: ['mazapan', 'mazapan liquido', 'pasta de mazapan', 'masa de mazapan'], per100g: p(460, 7, 21, 2, 62, 56, 4, 10, 10) },
  { description: 'Feuilletine (barquillo troceado)', aliases: ['feuilletine', 'feuillantine', 'feullantine', 'feuilletina', 'feuilletin', 'royaltine', 'paillete feuilletine', 'barquillo', 'barquillo triturado', 'barquillo troceado', 'crispy feuilletine', 'crepes dentelle'], per100g: p(460, 7, 14, 7, 76, 20, 2, 3, 300) },
  { description: 'Arroz hinchado / cereal crujiente', aliases: ['arroz hinchado', 'arroz inflado', 'crispies', 'crispy', 'krispies', 'crispearls', 'cereales crujientes'], per100g: p(390, 8, 3, 1, 84, 20, 2, 3, 200) },

  // ── sugars and sweeteners ──────────────────────────────────────────────
  { description: 'Jarabe de glucosa (DE 40)', aliases: ['glucosa', 'glucosa liquida', 'jarabe de glucosa', 'sirope de glucosa', 'glucosa de 40', 'glucosa 40', 'glucosa de 60', 'glucosa 60', 'glucosa 43', 'glucose'], per100g: p(320, 0, 0, 0, 80, 35, 0, 20, 30) },
  { description: 'Glucosa atomizada / dextrosa en polvo', aliases: ['glucosa en polvo', 'glucosa polvo', 'glucosa atomizada', 'glucosa seca', 'glucosa deshidratada', 'dextrosa', 'dextrosa en polvo', 'dextrosa polvo', 'dextrosa monohidrato', 'dextrose'], per100g: p(375, 0, 0, 0, 92, 92, 0, 8, 10) },
  { description: 'Azúcar invertido (Trimoline)', aliases: ['azucar invertido', 'azucar invertida', 'trimoline', 'invertido', 'azucar invertido oro', 'invert sugar'], per100g: p(310, 0, 0, 0, 78, 78, 0, 22, 20) },
  { description: 'Orosuc (jarabe de azúcar; valores aproximados)', aliases: ['orosuc', 'oro suc'], per100g: p(310, 0, 0, 0, 78, 78, 0, 22, 20) },
  { description: 'Sorbitol', aliases: ['sorbitol', 'sorbitol en polvo', 'sorbitol polvo', 'sorbitol cristalizado'], per100g: POLYOL },
  { description: 'Maltitol', aliases: ['maltitol', 'maltitol en polvo', 'maltitol polvo'], per100g: POLYOL },
  { description: 'Isomalt', aliases: ['isomalt', 'isomaltitol'], per100g: POLYOL },
  { description: 'Xilitol', aliases: ['xilitol', 'xylitol'], per100g: POLYOL },
  { description: 'Eritritol', aliases: ['eritritol', 'erythritol', 'sukrin'], per100g: p(20, 0, 0, 0, 100, 0, 0, 0) },
  { description: 'Edulcorante (estevia)', aliases: ['estevia', 'stevia', 'edulcorante', 'sucralosa'], per100g: ZERO },
  { description: 'Almíbar 1:1', aliases: ['jarabe', 'almibar', 'sirop', 'sirope', 'jarabe tpt', 'almibar tpt', 'jarabe de azucar', 'almibar ligero', 'jarabe base', 'almibar base', 'jarabe a 30', 'jarabe 30', 'almibar 30'], per100g: p(200, 0, 0, 0, 50, 50, 0, 50) },
  { description: 'Glaseado neutro (miroir / nappage)', aliases: ['miroir', 'glaseo neutro', 'glasage neutro', 'glaseado neutro',  'brillo neutro', 'nappage', 'nappage neutro', 'absolu cristal', 'absolu', 'glaseo absolu', 'cristal neutro', 'gelatina de brillo', 'brillo', 'glaseo neutro frio', 'miroir neutro'], per100g: p(250, 0, 0, 0, 62, 55, 0, 37, 20) },
  { description: 'Fondant', aliases: ['fondant', 'fondant blanco', 'fondant pastelero'], per100g: p(390, 0, 0, 0, 97, 90, 0, 3) },
  { description: 'Azúcar glas', aliases: [   'azucar glase',   'azucar impalpable', 'azucar antihumedad', 'azucar nieve', 'lustre'], per100g: p(389, 0, 0, 0, 99.8, 97.8, 0, 0.2, 2) },

  // ── gelling agents, thickeners, emulsifiers, stabilisers ───────────────
  { description: 'Masa de gelatina (1 parte gelatina, 5 de agua)', aliases: ['masa de gelatina', 'masa gelatina', 'gelatina en masa', 'gelatina hidratada', 'gelatina masa'], per100g: p(56, 14, 0, 0, 0, 0, 0, 83, 10) },
  { description: 'Agar-agar', aliases: ['agar', 'agar agar', 'agar-agar'], per100g: p(306, 6, 0.3, 0.1, 81, 3, 8, 9, 100) },
  { description: 'Pectina', aliases: ['pectina', 'pectina nh', 'pectina amarilla', 'pectina x58', 'pectina 325', 'pectina 325 nh', 'pectina jaune', 'pectina de manzana', 'pectina citrica', 'pectina rapida', 'pectina lenta'], per100g: p(250, 0, 0, 0, 80, 10, 0, 10, 100) },
  { description: 'Goma xantana', aliases: ['xantana', 'goma xantana', 'xantan', 'xanthan', 'goma xantan', 'xantana en polvo'], per100g: GUM },
  { description: 'Goma guar', aliases: ['goma guar', 'guar'], per100g: GUM },
  { description: 'Goma garrofín', aliases: ['garrofin', 'goma garrofin', 'goma de garrofin', 'harina de garrofin', 'goma de algarrobo'], per100g: GUM },
  { description: 'Alginato sódico', aliases: ['alginato', 'alginato sodico', 'alginato de sodio', 'algin'], per100g: p(0, 0, 0, 0, 60, 0, 60, 10, 10000) },
  { description: 'Sales para esferificación', aliases: ['cloruro calcico', 'calcic', 'citrato sodico', 'citras', 'gluco', 'gluconolactato', 'gluconolactato calcico', 'lactato calcico'], per100g: ZERO },
  { description: 'Lecitina de soja', aliases: ['lecitina', 'lecitina de soja', 'lecite', 'lecitina en polvo', 'lecitina soja'], per100g: p(760, 0, 95, 15, 0, 0, 0, 1) },
  { description: 'Sucroéster (Sucro / Sucroemul)', aliases: ['sucro', 'sucroemul', 'sucroester', 'sucro emul'], per100g: p(400, 0, 40, 20, 10, 0, 0, 2) },
  { description: 'Monoglicérido (Glice / Glicemul)', aliases: ['glice', 'glicemul', 'monoglicerido', 'mono y digliceridos', 'glicerol'], per100g: p(740, 0, 80, 60, 0, 0, 0, 2) },
  { description: 'Emulsionante vegetal (Natur Emul)', aliases: ['natur emul', 'naturemul'], per100g: p(400, 0, 40, 20, 10, 0, 0, 2) },
  { description: 'Emulsionante para bizcocho (Emulift)', aliases: ['emulift', 'emulsificante', 'emulsionante', 'emulgente', 'emulsionante para bizcocho', 'emulift bizcocho', 'esponjante'], per100g: p(390, 0, 25, 7, 40, 0, 0, 30) },
  { description: 'Inulina', aliases: ['inulina', 'inulin', 'fibra de achicoria', 'inulina en polvo'], per100g: p(200, 0, 0, 0, 92, 8, 90, 2) },
  { description: 'Dextrina / maltodextrina', aliases: ['dexina', 'dextrina', 'maltodextrina', 'maltodextrin', 'dextrina de patata'], per100g: p(380, 0, 0, 0, 95, 5, 0, 5) },
  { description: 'Almidón modificado (Gelcrem)', aliases: ['gelcrem', 'gelcrem fred', 'gelcrem frio', 'gelcrem calen', 'gelcrem caliente', 'almidon modificado', 'gelespessa', 'espesante', 'almidon de maiz modificado'], per100g: p(350, 0, 0, 0, 87, 0, 0, 10) },
  { description: 'Gelificante instantáneo (Instangel)', aliases: ['instangel', 'instant gel', 'gelatina instantanea', 'gelatina instant'], per100g: p(340, 40, 0, 0, 50, 20, 0, 8, 50) },
  { description: 'Base para sorbetes (Prosorbet)', aliases: ['prosorbet', 'prosorbet 5', 'prosorbet 100', 'pro sorbet', 'prosorbet frio', 'prosorbet 5 frio', 'estabilizante sorbete', 'estabilizante para sorbetes'], per100g: p(350, 0, 0, 0, 85, 70, 2, 8, 50) },
  { description: 'Base para helados (Procrema)', aliases: ['procrema', 'pro crema', 'procrema 100', 'procrema 5', 'estabilizante helado', 'estabilizante para helados', 'neutro para helados'], per100g: p(380, 10, 8, 5, 70, 40, 2, 5, 100) },
  { description: 'Base para sorbetes de fruta (Profruta)', aliases: ['profruta', 'profruta 100', 'profruta 50', 'pro fruta'], per100g: p(350, 0, 0, 0, 85, 70, 2, 8, 50) },
  { description: 'Gelificante / azúcar gelificante (Gelfix)', aliases: ['gelificante', 'gelificant', 'gelfix', 'gelfix 2 1', 'gelfix 3 1', 'azucar gelificante', 'gelatina vegetal'], per100g: p(300, 0, 0, 0, 78, 60, 4, 10, 100) },
  { description: 'Fruta liofilizada crujiente (crispies)', aliases: ['crispi frambuesa', 'crispy frambuesa', 'crispis frambuesa', 'frambuesa liofilizada', 'frambuesa crispy', 'crispi fresa', 'crispy fresa', 'fresa liofilizada', 'crispi mango', 'mango liofilizado', 'crispi pasion', 'crispi yuzu', 'fruta liofilizada', 'crispis'], per100g: p(350, 4, 2, 0, 80, 40, 10, 3) },
  { description: 'Estabilizante en polvo (Panasan; valores aproximados)', aliases: ['panasan'], per100g: p(350, 0, 0, 0, 85, 0, 0, 10) },
  { description: 'Proteína vegetal para montar (Sojawhip / Potatowhip)', aliases: ['sohawhip', 'sojawhip', 'soja whip', 'potatowhip', 'potato whip', 'proteina de soja', 'proteina de patata'], per100g: p(360, 60, 5, 1, 20, 5, 5, 6, 800) },
  { description: 'Albúmina (clara de huevo en polvo)', aliases: ['albumina', 'albumina en polvo', 'clara seca', 'clara en polvo', 'claras en polvo', 'clara de huevo en polvo', 'albumina de huevo', 'albumina seca', 'albuwhip', 'albu whip', 'ovoneve'], per100g: p(380, 82, 0, 0, 7, 7, 0, 8, 1300) },
  { description: 'Yema de huevo en polvo', aliases: ['yema en polvo', 'yema seca', 'yemas en polvo'], per100g: p(640, 30, 56, 18, 5, 2, 0, 4, 100) },
  { description: 'Ligante vegetal (Gelburger)', aliases: ['gelburguer', 'gelburger', 'gel burger'], per100g: p(150, 2, 0, 0, 70, 0, 40, 10, 500) },
  { description: 'Conservante (sorbato)', aliases: ['stopsin', 'stoph', 'stop', 'stop sin', 'sorbato', 'sorbato potasico', 'conservante', 'benzoato', 'benzoato sodico'], per100g: ZERO },
  { description: 'Colorante alimentario', aliases: ['color', 'colorante', 'color rojo', 'color rojo polvo', 'color rojo pasta', 'color rojo laca', 'color laca rojo', 'color verde', 'color verde menta', 'color negro', 'color naranja', 'color naranja polvo', 'color amarillo', 'color azul', 'color blanco', 'color morado', 'color violeta', 'color rosa', 'color marron', 'colorante rojo', 'colorante verde', 'colorante negro', 'colorante amarillo', 'colorante azul', 'colorante naranja', 'colorante blanco', 'dioxido de titanio', 'color oro', 'polvo de oro', 'oro en polvo', 'purpurina', 'colorante liposoluble', 'colorante hidrosoluble', 'color liposoluble', 'carbon vegetal', 'carbon activo', 'rojo laca', 'laca roja', 'laca rojo', 'verde laca', 'laca verde', 'amarillo laca', 'azul laca', 'rojo polvo', 'verde polvo', 'negro polvo', 'amarillo polvo', 'azul polvo', 'naranja polvo', 'rojo pasta', 'verde pasta', 'colorante en pasta', 'colorante en polvo', 'laca'], per100g: ZERO },
  { description: 'Ácidos y sales técnicas', aliases: ['acido citrico', 'acido ascorbico', 'acido tartarico', 'cremor tartaro', 'acido malico', 'acido lactico', 'citrico', 'ascorbico'], per100g: ZERO },
  { description: 'Bicarbonato sódico', aliases: [   'bicarbonato de soda', 'soda'], per100g: p(0, 0, 0, 0, 0, 0, 0, 0, 27360) },
  { description: 'Impulsor químico (levadura química)', aliases: [ 'impulgas', 'royal',      'impulsor quimico', 'levadura impulsora',  'impulsor royal'], per100g: p(53, 0, 0, 0, 28, 0, 0, 6, 10600) },
  { description: 'Levadura fresca de panadería', aliases: [   'levadura panadera', 'levadura de panadero', 'levadura de pan', 'levadura biologica'], per100g: p(105, 8.4, 1.9, 0.2, 12, 0, 8, 69, 30) },
  { description: 'Mejorante panario', aliases: ['mejorante', 'mejorante panario', 'mejorante de pan', 'mejorante para pan'], per100g: p(350, 10, 3, 1, 70, 5, 3, 8, 500) },
  { description: 'Masa madre líquida (100% hidratación)', aliases: ['masa madre', 'masa madre liquida', 'prefermento', 'poolish', 'esponja', 'espuma'], per100g: p(150, 5, 0.5, 0, 31, 1, 2, 60, 300) },

  // ── flours, nuts and dairy under trade names ───────────────────────────
  { description: 'Harina de trigo (panadera / pastelera)', aliases: ['harina huracan', 'huracan',   'harina espuma',  'harina pastelera', 'harina gran fuerza', 'harina media fuerza', 'harina de media fuerza',   'harina blanca'], per100g: p(364, 10.3, 1, 0.2, 76.3, 0.3, 2.7, 11.9, 2) },
  { description: 'Harina de almendra', aliases: [    'almendra en polvo', 'almendra polvo',  'harina de almendra marcona', 'almendra marcona harina', 'polvo de almendra', 'almendra marcona molida', 'almendra en polvo marcona'], per100g: p(590, 21, 50, 4, 21, 4, 12, 5) },
  { description: 'Harina de avellana', aliases: ['harina de avellana', 'harina avellana', 'avellana en polvo', 'avellana polvo', 'avellana molida', 'polvo de avellana', 'harina de avellanas'], per100g: p(650, 15, 61, 4.5, 17, 4, 10, 5) },
  { description: 'Harina de pistacho', aliases: ['harina de pistacho', 'pistacho en polvo', 'pistacho molido', 'polvo de pistacho'], per100g: p(560, 20, 45, 6, 27, 8, 10, 4) },
  { description: 'Harina de coco', aliases: ['harina de coco'], per100g: p(400, 18, 13, 11, 60, 9, 38, 7, 30) },
  { description: 'Harina de trigo sarraceno', aliases: ['sarraceno', 'harina de sarraceno', 'harina sarraceno', 'trigo sarraceno', 'alforfon', 'harina de trigo sarraceno', 'harina de alforfon'], per100g: p(335, 12.6, 3.1, 0.7, 70.6, 2.6, 10, 11, 11) },
  { description: 'Psyllium', aliases: ['psyllium', 'psilio', 'cascara de psyllium', 'psyllium en polvo'], per100g: p(200, 2, 0, 0, 82, 0, 80, 10) },
  { description: 'Nata para montar 35%', aliases: ['nata semi', 'nata semimontada', 'nata semi montada', 'nata montada', 'nata 38%', 'nata 36%', 'nata 35', 'nata liquida 35%',  'nata de montar', 'nata montar', 'nata 35 mg'], per100g: CREAM },
  { description: 'Nata vegetal para montar', aliases: ['nata vegana', 'nata de soja', 'nata vegetal', 'nata para montar vegetal', 'crema vegetal', 'nata vegetal para montar'], per100g: p(280, 1, 25, 18, 10, 8, 0, 60, 50) },
  { description: 'Bebida de avena', aliases: ['leche de avena', 'bebida de avena', 'leche avena'], per100g: p(45, 1, 1.5, 0.2, 7, 4, 0.8, 90, 40) },
  { description: 'Bebida de almendra', aliases: ['leche de almendra', 'bebida de almendra', 'leche de almendras', 'leche almendra'], per100g: p(17, 0.5, 1.2, 0.1, 0.6, 0.3, 0.3, 97, 60) },
  { description: 'Bebida de arroz', aliases: ['leche de arroz', 'bebida de arroz'], per100g: p(47, 0.3, 1, 0, 9.2, 5.3, 0.3, 89, 40) },
  { description: 'Mascarpone', aliases: ['mascarpone', 'queso mascarpone'], per100g: p(429, 4.8, 44, 29, 4.8, 3.9, 0, 45, 40) },
  { description: 'Queso crema (tipo Philadelphia)', aliases: ['philadelphia',    'queso cremoso', 'queso filadelfia', 'filadelfia'], per100g: p(342, 6, 34, 19, 5.5, 3.8, 0, 53, 320) },
  { description: 'Queso fresco batido', aliases: ['queso fresco batido', 'queso batido', 'queso quark', 'quark'], per100g: p(60, 7, 0.2, 0.1, 7, 7, 0, 85, 50) },
  { description: 'Pasta de vainilla', aliases: ['pasta de vainilla', 'pasta vainilla', 'vainilla en pasta',   'vainilla liquida', 'aroma de vainilla'], per100g: p(288, 0, 0, 0, 13, 13, 0, 53, 9) },
  { description: 'Café soluble', aliases: ['nescafe', 'cafe soluble', 'cafe instantaneo', 'cafe liofilizado', 'cafe en polvo'], per100g: p(353, 12, 0.5, 0.2, 75, 0, 0, 3, 37) },
  { description: 'Hielo', aliases: ['hielo', 'hielo picado', 'cubitos de hielo'], per100g: p(0, 0, 0, 0, 0, 0, 0, 100) },

  // ── spirits and liqueurs (alcohol in g per 100 g) ─────────────────────
  { description: 'Destilado 40% (ron, vodka, ginebra, whisky, brandy)', aliases: ['whisky', 'whiskey', 'bourbon', 'vodka', 'ginebra', 'gin', 'ron blanco', 'ron negro', 'ron anejo', 'ron sant james', 'ron saint james', 'tequila', 'kirsch', 'cachaca', 'pisco', 'brandy', 'conac', 'cognac', 'aguardiente', 'orujo', 'armagnac', 'calvados', 'grappa', 'absenta', 'mezcal'], per100g: p(231, 0, 0, 0, 0, 0, 0, 67, 0, 33) },
  { description: 'Licor de naranja (Cointreau / triple sec)', aliases: ['cointreau', 'triple sec', 'grand marnier', 'licor de naranja', 'curacao', 'curacao azul', 'licor de mandarina'], per100g: p(300, 0, 0, 0, 25, 25, 0, 45, 0, 32) },
  { description: 'Licor dulce (amaretto, anís, licor 43, crema de licor)', aliases: ['amaretto', 'amareto', 'licor de almendra', 'licor 43', 'baileys', 'crema de whisky', 'limoncello', 'ratafia', 'anis dulce', 'anis del mono', 'anis dulce el mono', 'licor de anis', 'pacharan', 'licor de cafe', 'kahlua', 'frangelico', 'tia maria', 'licor de avellana', 'licor de cereza', 'licor de melocoton', 'licor de manzana', 'licor de cassis', 'creme de cassis', 'chartreuse', 'sambuca', 'licor de huevo', 'advocaat', 'licor de menta'], per100g: p(320, 0, 4, 2, 32, 32, 0, 40, 0, 24) },
  { description: 'Licor de coco (Malibú)', aliases: ['malibu', 'licor de coco', 'malibu coco'], per100g: p(250, 0, 0, 0, 24, 24, 0, 55, 0, 21) },
  { description: 'Vino dulce / fortificado (oporto, moscatel, vermut, jerez)', aliases: ['oporto', 'vino de oporto', 'porto', 'moscatel', 'vino moscatel', 'vermut', 'vermouth', 'vermut rojo', 'martini rojo', 'martini blanco', 'jerez', 'vino de jerez', 'pedro ximenez', 'px', 'mistela', 'marsala', 'madeira', 'vino rancio'], per100g: p(160, 0, 0, 0, 12, 12, 0, 68, 0, 17) },
  { description: 'Cava / champán', aliases: ['cava', 'champan', 'champagne', 'espumoso', 'prosecco', 'vino espumoso', 'cava brut'], per100g: p(76, 0, 0, 0, 1.5, 1, 0, 88, 0, 11) },
  { description: 'Tónica', aliases: ['tonica', 'agua tonica'], per100g: p(34, 0, 0, 0, 8.8, 8.8, 0, 91, 4) },
]

const index = new Map<string, PastryProduct>()
for (const product of PASTRY_PRODUCTS) {
  for (const alias of product.aliases) {
    for (const variant of singularVariants(foodKey(alias, { stripModifiers: false }))) {
      if (!index.has(variant)) index.set(variant, product)
    }
  }
}

function lookup(key: string): PastryProduct | undefined {
  if (!key) return undefined
  for (const variant of singularVariants(key)) {
    const found = index.get(variant)
    if (found) return found
  }
  return undefined
}

/** Exact-name match (after normalisation) against the curated product table. */
export function findPastryProduct(...names: (string | undefined | null)[]): PastryProduct | undefined {
  for (const name of names) {
    if (!name) continue
    const found = lookup(foodKey(name, { stripModifiers: false })) ?? lookup(foodKey(name))
    if (found) return found
  }
  return undefined
}
