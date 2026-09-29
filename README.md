# NESTOR — nestorhorizoneu.com

A static rebuild of the NESTOR project site, originally a WordPress install
using the `startorg` block theme.

NESTOR is funded by the European Union under Horizon Europe (project 101120075).

## Stack

- **[Astro](https://astro.build)** — static output, no server runtime
- **Tailwind v4** — available for components; the block layer is hand-written CSS
- **Plus Jakarta Sans** — the original theme's typeface (OFL, via Google Fonts)

## How it works

The WordPress install remains the editing surface. `scripts/pull-content.mjs`
snapshots it into the repo, and Astro builds static HTML from that snapshot.

```
WordPress (REST API)  ──pull──▶  src/content/*.json + public/media/  ──build──▶  dist/
```

```bash
npm install
npm run content:pull   # refresh content + media from the live WP site
npm run dev            # local dev server
npm run build          # static build into dist/
npm run preview        # serve the build locally
```

Re-run `npm run content:pull` whenever the team edits content in WordPress, then
rebuild. Nothing else needs touching.

### What the pull script does

- Fetches all pages, posts and media via the WP REST API.
- Scrapes the front page's `<main>` — the homepage is a block *template*, so it
  never appears in the REST collections.
- Downloads every referenced asset into `public/media/` and rewrites URLs to
  local, root-relative paths. URL rewriting is **attribute-scoped**, because the
  privacy policy quotes the site's own URL in prose and must keep it verbatim.
- Resolves `?page_id=N` links to real slugs.
- Strips Jetpack/WordPress tracking pixels.
- Removes Automattic's Mapbox API key and blog ID from the Jetpack map block.
- Prunes media the content doesn't reference (~715 MB of orphaned uploads,
  including three unused videos), and drops the matching `media.json` entries.
- Runs `scripts/optimize-images.mjs`, which downscales anything over 2400px on
  its longest edge and converts it to WebP, rewriting every reference. The
  library held raw camera exports — one was 8256×5504 (45 megapixels, 14 MB)
  displayed about 1200px wide. This takes ~50 MB of images down to ~4.6 MB.

## Design tokens

Taken verbatim from the theme's `theme.json` so exported block content renders
identically — see `src/styles/global.css`.

| Token     | Value     |
| --------- | --------- |
| Base      | `#2c2c2c` |
| Contrast  | `#eaeaea` |
| Primary   | `#b2b3b5` |
| Secondary | `#31e2a2` |
| Tertiary  | `#1a1a1a` |

Layout widths: content `620px`, wide `1300px`.

## Structure

```
scripts/pull-content.mjs     WordPress → repo snapshot
src/config/site.ts           header/footer/hero content + contact details
src/content/                 generated — pages.json, posts.json, home.html
src/styles/global.css        design tokens + WP core block layout system
src/styles/blocks-plugins.css  accordion, timeline, slideshow, gallery, forms
src/scripts/blocks.ts        accordion + slideshow behaviour (replaces Swiper)
src/layouts/Base.astro       document shell, meta, Open Graph
src/components/              Header, Footer, BlockContent, PageHeading, ContactForm
src/pages/                   routes (URLs match the live site exactly)
```

URLs are preserved, including dated post permalinks (`/2025/06/18/mommasvoices/`),
so inbound links and search results keep resolving.

## Deliberate differences from the live site

These are intentional. Each preserves the visual result while fixing a defect.

1. **Contact form.** The Jetpack form posted back to PHP and can't work on a
   static host. Replaced with `src/components/ContactForm.astro`.
   **Set `contact.formEndpoint` in `src/config/site.ts`** (Formspree, Netlify
   Forms, a Worker — anything that accepts a POST) to activate it. Until then it
   falls back to opening a pre-filled email to `info@nestorhorizoneu.com`.
2. **Heading semantics.** The WordPress templates emit the site title as an
   `<h1>` in both the header and the footer, and render page titles as `<h3>` —
   so every inner page had two or three `<h1>`s. Each page now has exactly one
   `<h1>`, styled to look identical.
3. **Jetpack extras dropped**: comments, sharing buttons, "Like this", and the
   embedded map widget. None carried project content. Dropping the trackers also
   removes the only reason the site needed a cookie-consent banner.
4. **Slideshow** re-implemented with CSS scroll-snap instead of Swiper.
5. **`has-theme-N-*` classes left undefined.** These appear throughout the
   content but no stylesheet defines them — they're leftovers from a previously
   active theme and are inert on the live site too.
6. **Sitemap + `robots.txt` added.** The WordPress install serves no sitemap
   (`wp-sitemap.xml` returns 404).
7. **Nav label normalised.** The templates spell it "Nestor ACADEMY" on the home
   page and "NESTOR ACADEMY" on inner pages; now one label.
8. Footer credit still reads "Designed with WordPress" (`site.credit`) — worth
   updating, since it no longer is.

## Asset optimization

The WordPress originals were served unoptimized. Both the video and the images
are now processed, taking a homepage visit from ~56 MB to a couple of MB.

| Asset | Before | After |
| ----- | ------ | ----- |
| Hero video | 55.9 MB | 2.3 MB (+ 57 KB poster) |
| Content images | ~50 MB | ~4.6 MB |
| `dist/` total | 107 MB | ~8 MB |

- `npm run hero:optimize` — 1280×720 CRF 28 H.264 with `+faststart`, plus a
  poster frame. Outputs to `public/hero/`, which **is committed**: `public/media/`
  is gitignored and wiped by `content:pull`, so derivatives can't live there.
  Needs ffmpeg; re-downloads the original if it isn't present locally.
- `npm run images:optimize` — runs automatically as part of `content:pull`.
  Caps the longest edge at 2400px (≈2× the 1300px layout, for retina), converts
  to WebP, and rewrites references. Keeps the original whenever WebP comes out
  larger, never upscales, and bakes in EXIF orientation so the phone photos
  don't end up sideways.

Two assets are deliberately **not** converted, and are listed in that script's
`SKIP` set: the favicon (PNG has the broadest icon support) and the site logo
(referenced from `src/config/site.ts`, so converting it would desync the config).
The EU funding badge *is* converted — if you change that, keep
`euFunding.badge.src` in sync with the `SKIP` list.

Still outstanding:

- The **live WordPress site** still serves the unoptimized originals. This
  repo's pipeline doesn't touch it.
- The live Contacts page renders a literal, unevaluated `context.image.src`
  placeholder — a bug in the WordPress build. Not reproduced here.

`public/media/` is gitignored — it's fully reproducible via
`npm run content:pull`.

## Deploying

Any static host works — `npm run build` and serve `dist/`. Configure the host to
serve `404.html` for unmatched routes.

Because media is gitignored, CI must run `npm run content:pull` before
`npm run build` (this requires the WordPress site to be reachable). Alternatively,
commit `public/media/` via Git LFS once the video and images are optimised.
