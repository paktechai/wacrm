import type { MetadataRoute } from 'next';
import { publicUrl } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/product',
        '/contact',
        '/privacy',
        '/terms',
        '/data-deletion',
      ],
      disallow: [
        '/api/',
        '/auth/',
        '/dashboard',
        '/crm',
        '/inbox',
        '/contacts',
        '/settings',
        '/admin',
        '/join/',
        '/agents',
        '/automations',
        '/broadcasts',
        '/flows',
        '/pipelines',
      ],
    },
    sitemap: publicUrl('/sitemap.xml'),
    host: publicUrl('/'),
  };
}
