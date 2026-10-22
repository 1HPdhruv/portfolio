import { defineConfig } from 'astro/config';

// SITE (e.g. https://example.com) enables absolute canonical/OG URLs and the sitemap. Unset = relative URLs.
export default defineConfig({
  site: process.env.SITE || undefined,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: { server: { fs: { allow: ['..'] } } },
});
