export const RECIPE_TYPES = ['cocina', 'pasteleria', 'bebidas'] as const
export type RecipeType = (typeof RECIPE_TYPES)[number]

export const CATEGORIES_BY_TYPE = {
    pasteleria: [
        'Bizcochos', 'Bombones', 'Cake pops', 'Cakes', 'Brownies', 'Centros', 'Chocolate',
        'Conservas', 'Copas', 'Cremas', 'Cremosos', 'Deshidratados', 'Esferificaciones',
        'Espumas', 'Ganaches', 'Gelatinas', 'Glaseos', 'Hojaldre', 'Individuales', 'Jarabes',
        'Mantequillas', 'Masas cocidas', 'Masas fermentadas', 'Masas de galletas', 'Menús',
        'Merengues', 'Mousse', 'Natas montadas', 'Panadería', 'Pasteles buffet', 'Petit four',
        'Postres tradicionales', 'Salsas', 'Sin alérgenos', 'Sin azúcares', 'Tarta', 'Troncos',
        'Varios', 'Vasitos',
    ],
    cocina: [
        'Aperitivos', 'Carnes', 'Catering', 'Chutneys', 'Cremas', 'Crujientes', 'Entrantes',
        'Gelatinas', 'Hamburguesas', 'Masas', 'Masas fermentadas', 'Primeros', 'Quiches',
        'Salsas', 'Segundos', 'Sin alérgenos', 'Sin azúcares', 'Verduras',
    ],
    bebidas: [
        'Batidos', 'Cóktails', 'Infusiones', 'Smoothies',
    ],
} as const satisfies Record<RecipeType, readonly string[]>

export const ALL_CATEGORIES = [
    ...CATEGORIES_BY_TYPE.cocina,
    ...CATEGORIES_BY_TYPE.pasteleria,
] as const
