import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mincely — Recetas con IA',
    short_name: 'Mincely',
    description: 'Convierte cualquier receta en datos estructurados con inteligencia artificial',
    lang: 'es',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#dc2626',
    categories: ['food', 'utilities'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nueva receta', url: '/recipes/new', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
