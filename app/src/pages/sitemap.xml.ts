import type { APIRoute } from 'astro';
import { projects } from '../content/data';

// Sitemaps need absolute URLs, so entries are only listed when SITE is set at build time.
export const GET: APIRoute = ({ site }) => {
  const paths = ['/', '/research', ...projects.map((p) => `/work/${p.id}`)];
  const urls = site ? paths.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n') : '  <!-- set SITE at build time to list URLs -->';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { 'Content-Type': 'application/xml' } });
};
