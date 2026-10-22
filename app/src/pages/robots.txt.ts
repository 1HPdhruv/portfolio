import type { APIRoute } from 'astro';

// The bare world page is an implementation detail of the home page; keep it out of search results.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /world/\n${site ? `\nSitemap: ${new URL('/sitemap.xml', site)}\n` : ''}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
