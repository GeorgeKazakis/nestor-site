import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

/*
 * Deploy target is env-driven so one codebase serves both the real domain and
 * the GitHub Pages preview:
 *
 *   production (nestorhorizoneu.com):  no env vars needed
 *   GitHub Pages preview:              SITE_URL + BASE_PATH + NOINDEX=1
 */
const site = process.env.SITE_URL || 'https://nestorhorizoneu.com'
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  // The WordPress install serves no sitemap (wp-sitemap.xml 404s), so generate one.
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
})
