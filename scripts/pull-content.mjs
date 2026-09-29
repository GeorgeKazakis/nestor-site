/**
 * Pulls content out of the live WordPress install into src/content/ and public/media/.
 *
 * The WP site stays the source of truth for editing; this snapshots it for the
 * static build. Re-run with `npm run content:pull` after content changes.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const SRC = 'https://nestorhorizoneu.com'
const API = `${SRC}/wp-json/wp/v2`
const ROOT = path.resolve(import.meta.dirname, '..')
const CONTENT = path.join(ROOT, 'src/content')
const MEDIA = path.join(ROOT, 'public/media')

/** Fetch every page of a paginated WP collection. */
async function fetchAll(endpoint) {
  const out = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}/${endpoint}?per_page=100&page=${page}`)
    if (res.status === 400) break // past the last page
    if (!res.ok) throw new Error(`${endpoint} p${page}: ${res.status} ${res.statusText}`)
    const batch = await res.json()
    out.push(...batch)
    const total = Number(res.headers.get('x-wp-totalpages') || 1)
    if (page >= total) break
  }
  return out
}

/** Download a remote asset into public/media/, skipping files already present. */
async function localizeAsset(url) {
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop())
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const dest = path.join(MEDIA, safe)
  if (!existsSync(dest)) {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  ! skipped ${name} (${res.status})`)
      return null
    }
    await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  }
  return `/media/${safe}`
}

/**
 * Rewrite absolute links so the static build is self-contained:
 * media points at local files, internal links become root-relative.
 */
async function rewriteHtml(html, assetMap) {
  let out = html

  // Media served from wp-content/uploads -> /media/<file>
  const uploads = [...out.matchAll(/https?:\/\/[^"'\s)]*?\/wp-content\/uploads\/[^"'\s)]+/g)]
  for (const [url] of uploads) {
    if (assetMap.has(url)) {
      out = out.replaceAll(url, assetMap.get(url))
      continue
    }
    const local = await localizeAsset(url)
    if (local) {
      assetMap.set(url, local)
      out = out.replaceAll(url, local)
    }
  }

  /*
   * Internal links -> root-relative, but ONLY inside attribute values.
   * A blanket replace also rewrites visible text: the privacy policy quotes
   * the site's own URL in prose ("accessible from https://nestorhorizoneu.com"),
   * which must stay intact.
   */
  const toRootRelative = (value) =>
    value.replaceAll(`${SRC}/`, '/').replaceAll(SRC, '/')

  out = out.replace(
    /\b(href|src|srcset|action|poster|content|data-[\w-]+)=("([^"]*)"|'([^']*)')/g,
    (match, attr, _quoted, dq, sq) => {
      const quote = dq !== undefined ? '"' : "'"
      const value = dq !== undefined ? dq : sq
      return `${attr}=${quote}${toRootRelative(value)}${quote}`
    }
  )

  // Strip WP/Jetpack tracking pixels and inline block-editor comments.
  out = out.replace(/<img[^>]*?(?:stats\.wp\.com|pixel\.wp\.com)[^>]*?>/g, '')
  out = out.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '')

  /*
   * The Jetpack contact-form block only renders a "Submit a form." link over
   * REST — the real form is posted back to PHP. Swap in a marker that the
   * contacts route replaces with a static-friendly form.
   */
  out = out.replace(
    /<div[^>]*class="[^"]*wp-block-jetpack-contact-form[^"]*"[^>]*>[\s\S]*?<\/div>/g,
    '<!--CONTACT_FORM-->'
  )

  /*
   * The Jetpack map block ships Automattic's own Mapbox API key and the blog
   * ID in markup. Drop those attributes — not ours to ship — and keep the
   * inner address link, which degrades perfectly well on its own.
   */
  out = out.replace(/<div([^>]*class="[^"]*wp-block-jetpack-map[^"]*"[^>]*)>/g, (m, attrs) => {
    const cleaned = attrs.replace(
      /\s(?:data-api-key|data-blog-id|data-map-id|data-map-provider|data-map-style)="[^"]*"/g,
      ''
    )
    return `<div${cleaned}>`
  })

  return out
}

/**
 * The front page is a block *template*, not a page, so it never appears in the
 * REST collections. Scrape its rendered <main> instead.
 */
async function pullFrontPage(assetMap, resolveIdLinks = (html) => html) {
  const res = await fetch(SRC)
  if (!res.ok) throw new Error(`front page: ${res.status}`)
  const html = await res.text()
  const match =
    html.match(/<main[^>]*>([\s\S]*)<\/main>/) ??
    html.match(/<div class="wp-site-blocks">([\s\S]*)<\/div>\s*<\/body>/)
  if (!match) throw new Error('could not locate front-page <main>')

  let body = await rewriteHtml(match[1], assetMap)
  // Drop the theme's duplicate header/footer regions if they fell inside <main>.
  body = body.replace(/<(header|footer)[\s\S]*?<\/\1>/g, '')
  body = resolveIdLinks(body)
  await writeFile(path.join(CONTENT, 'home.html'), body)
  console.log(`Wrote src/content/home.html (${Math.round(body.length / 1024)}kb)`)
}

/**
 * Assets referenced by the hand-built header/footer components rather than by
 * page content, so the reference scan below can't see them.
 */
const TEMPLATE_ASSETS = [
  // NOTE: nestor2.mp4 is deliberately absent. The hero uses the optimised
  // derivative in public/hero/ (see scripts/optimize-hero.mjs), so the 56MB
  // original is pruned rather than shipped.
  'Logo_Long-01.png', // site logo
  'cropped-NESTOR_LOGO_N-01-1.png', // favicon / apple-touch-icon
  'NESTOR_LOGO_N-01-1.png',
  // EU funding badge shown in the header. Listed under its original .png name
  // because pruning runs before optimize-images.mjs converts it to .webp.
  'EN_FundedbytheEU_RGB_NEG.png',
]

/**
 * The WP media library holds a lot of orphaned uploads — including two unused
 * videos totalling ~560MB. Drop anything no page actually references.
 */
async function pruneUnusedMedia() {
  const { readdir, stat, unlink } = await import('node:fs/promises')

  const haystack = [
    await readFile(path.join(CONTENT, 'pages.json'), 'utf8'),
    await readFile(path.join(CONTENT, 'posts.json'), 'utf8'),
    await readFile(path.join(CONTENT, 'home.html'), 'utf8'),
  ].join('')

  const files = await readdir(MEDIA)
  let removed = 0
  let freed = 0

  for (const file of files) {
    if (TEMPLATE_ASSETS.includes(file)) continue
    if (haystack.includes(`/media/${file}`)) continue
    const full = path.join(MEDIA, file)
    freed += (await stat(full)).size
    await unlink(full)
    removed++
  }

  console.log(
    `Pruned ${removed} unreferenced assets (${(freed / 1048576).toFixed(1)}MB freed)`
  )

  /*
   * Drop media-library entries whose files were just pruned, so the index
   * describes what's actually on disk rather than dangling at ~65 stale paths.
   */
  const indexPath = path.join(CONTENT, 'media.json')
  const index = JSON.parse(await readFile(indexPath, 'utf8'))
  const kept = Object.fromEntries(
    Object.entries(index).filter(([, item]) =>
      existsSync(path.join(ROOT, 'public', item.src))
    )
  )
  const dropped = Object.keys(index).length - Object.keys(kept).length
  if (dropped > 0) {
    await writeFile(indexPath, JSON.stringify(kept, null, 2))
    console.log(`Dropped ${dropped} stale entries from media.json`)
  }
}

async function main() {
  await mkdir(CONTENT, { recursive: true })
  await mkdir(MEDIA, { recursive: true })

  console.log('Fetching collections...')
  const [pages, posts, media] = await Promise.all([
    fetchAll('pages'),
    fetchAll('posts'),
    fetchAll('media'),
  ])
  console.log(`  ${pages.length} pages, ${posts.length} posts, ${media.length} media items`)

  const assetMap = new Map()

  // Pre-seed the asset map with the media library so IDs resolve to local paths.
  const mediaIndex = {}
  for (const m of media) {
    const url = m.source_url
    if (!url) continue
    const local = assetMap.get(url) ?? (await localizeAsset(url))
    if (!local) continue
    assetMap.set(url, local)
    mediaIndex[m.id] = {
      id: m.id,
      src: local,
      alt: m.alt_text ?? '',
      caption: m.caption?.rendered ?? '',
      width: m.media_details?.width ?? null,
      height: m.media_details?.height ?? null,
    }
  }
  console.log(`  localized ${assetMap.size} assets`)

  const normalize = async (item, type) => ({
    id: item.id,
    type,
    slug: item.slug,
    title: item.title?.rendered ?? '',
    excerpt: item.excerpt?.rendered ?? '',
    content: await rewriteHtml(item.content?.rendered ?? '', assetMap),
    date: item.date,
    modified: item.modified,
    featuredMedia: mediaIndex[item.featured_media] ?? null,
    parent: item.parent ?? 0,
    order: item.menu_order ?? 0,
  })

  const outPages = []
  for (const p of pages) outPages.push(await normalize(p, 'page'))
  const outPosts = []
  for (const p of posts) outPosts.push(await normalize(p, 'post'))

  // Some editors linked pages by raw ID (/?page_id=254). Resolve to pretty URLs.
  const slugById = new Map(pages.map((p) => [p.id, p.slug]))
  const resolveIdLinks = (html) =>
    html.replace(/\/?\?page_id=(\d+)/g, (match, id) => {
      const slug = slugById.get(Number(id))
      return slug ? `/${slug}/` : match
    })

  for (const entry of [...outPages, ...outPosts]) {
    entry.content = resolveIdLinks(entry.content)
  }

  await writeFile(path.join(CONTENT, 'pages.json'), JSON.stringify(outPages, null, 2))
  await writeFile(path.join(CONTENT, 'posts.json'), JSON.stringify(outPosts, null, 2))
  await writeFile(path.join(CONTENT, 'media.json'), JSON.stringify(mediaIndex, null, 2))

  console.log('Wrote src/content/{pages,posts,media}.json')

  await pullFrontPage(assetMap, resolveIdLinks)
  await pruneUnusedMedia()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
