import type { MetadataRoute } from 'next';
import { WOVA8 } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: WOVA8.productName,
    short_name: WOVA8.productName,
    description: WOVA8.description,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#07090d',
    theme_color: '#07090d',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/wova8-pwa-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/wova8-pwa-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
