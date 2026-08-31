import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, publicUrl } from '@/lib/brand';

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: publicUrl(path),
    lastModified: new Date('2026-08-27T00:00:00.000Z'),
    changeFrequency: path === '/' || path === '/product' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/product' ? 0.9 : 0.5,
  }));
}
