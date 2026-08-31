import type { Metadata } from 'next';
import { publicUrl, WOVA8 } from '@/lib/brand';

export function marketingMetadata(
  title: string,
  description: string,
  path: string
): Metadata {
  const canonical = publicUrl(path);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: WOVA8.companyName,
      title,
      description,
      url: canonical,
      images: [
        { url: publicUrl('/opengraph-image'), width: 1200, height: 630 },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [publicUrl('/opengraph-image')],
    },
  };
}
