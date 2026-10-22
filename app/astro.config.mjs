import { defineConfig } from 'astro/config';

// SITE (e.g. https://example.com) enables absolute canonical/OG URLs and the sitemap. Unset = relative URLs.
// TEST_HOOKS=1 is the QA build (pnpm build:qa → dist-qa/): same pages with window.__app compiled in for the e2e suite.
const hooks = process.env.TEST_HOOKS === '1';
// SITE goes into canonical, og:url, og:image and the sitemap, so a malformed value would publish wrong URLs: refuse it.
if (process.env.SITE) {
  let u; try { u = new URL(process.env.SITE); } catch { throw new Error(`SITE must be an absolute URL, got ${JSON.stringify(process.env.SITE)}`); }
  if (u.protocol !== 'https:' || u.pathname !== '/' || u.search || u.hash) throw new Error(`SITE must be a bare https origin such as https://example.dev (got ${process.env.SITE})`);
}
if (hooks) process.env.PUBLIC_TEST_HOOKS = '1'; else delete process.env.PUBLIC_TEST_HOOKS;

export default defineConfig({
  outDir: hooks ? './dist-qa' : './dist',
  site: process.env.SITE || undefined,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: { server: { fs: { allow: ['..'] } } },
});
