/**
 * Base-path helpers.
 *
 * The site is built root-relative for its real home (nestorhorizoneu.com), but
 * GitHub Pages project sites serve from a subpath (/nestor-site/). Astro's
 * `base` handles its own routing, but NOT the hardcoded root-relative URLs
 * inside the exported WordPress block HTML — those need rewriting explicitly.
 */

/** Astro's configured base, always with a trailing slash ('/' when unset). */
const BASE_URL: string = import.meta.env.BASE_URL || '/'

/** Base without its trailing slash, so it can be concatenated with '/foo'. */
const PREFIX = BASE_URL.replace(/\/$/, '')

export const hasBase = PREFIX !== ''

/** Prefix an absolute in-site path with the base path. */
export function withBase(path: string): string {
  if (!hasBase) return path
  if (!path.startsWith('/') || path.startsWith('//')) return path
  return `${PREFIX}${path}`
}

/** Prefix every URL in a srcset value ("/a.png 745w, /b.png 226w"). */
function rewriteSrcset(value: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim()
      if (!trimmed) return trimmed
      const [url, ...descriptors] = trimmed.split(/\s+/)
      return [withBase(url), ...descriptors].join(' ')
    })
    .join(', ')
}

/**
 * Rewrite root-relative URLs inside a chunk of raw HTML so they resolve under
 * the base path. No-op when the site is served from the domain root.
 */
export function rewriteBase(html: string): string {
  if (!hasBase) return html

  let out = html.replace(
    /\b(href|src|poster|action)="\/(?!\/)([^"]*)"/g,
    (_m, attr, rest) => `${attr}="${PREFIX}/${rest}"`
  )

  out = out.replace(
    /\bsrcset="([^"]*)"/g,
    (_m, value) => `srcset="${rewriteSrcset(value)}"`
  )

  return out
}
