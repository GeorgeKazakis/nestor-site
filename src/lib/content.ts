import pagesData from '../content/pages.json'
import postsData from '../content/posts.json'

export interface Entry {
  id: number
  type: 'page' | 'post'
  slug: string
  title: string
  excerpt: string
  content: string
  date: string
  modified: string
  featuredMedia: { src: string; alt: string; width: number | null; height: number | null } | null
  parent: number
  order: number
}

export const pages = pagesData as Entry[]
export const posts = postsData as Entry[]

/** Strip the HTML WordPress wraps around rendered titles/excerpts. */
export function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#8217;|&#039;|&apos;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Posts keep WordPress's dated permalink structure (/YYYY/MM/DD/slug/) so
 * existing inbound links and search results continue to resolve.
 */
export function postPath(post: Entry): string {
  const d = new Date(post.date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `/${yyyy}/${mm}/${dd}/${post.slug}/`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Build a short meta description from a page/post's own copy. */
export function metaDescription(entry: Entry, fallback: string): string {
  const source = plain(entry.excerpt) || plain(entry.content)
  if (!source) return fallback
  return source.length > 155 ? `${source.slice(0, 152).trimEnd()}…` : source
}
