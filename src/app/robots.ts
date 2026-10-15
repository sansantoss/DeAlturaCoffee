import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** /robots.txt: Google puede leer todo lo público; el portal y la API quedan fuera. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/*/account', '/*/admin', '/*/cart'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
