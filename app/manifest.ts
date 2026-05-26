import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Mincely — Recetas con IA',
        short_name: 'Mincely',
        description: 'Convierte cualquier receta en datos estructurados con inteligencia artificial',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#DC2626',
        categories: ['food', 'utilities'],
        icons: [
            {
                src: '/logo.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/logo.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    }
}
