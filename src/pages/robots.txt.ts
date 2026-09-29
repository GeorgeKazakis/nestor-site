import type { APIRoute } from 'astro'

/*
 * Generated rather than static so it follows the deploy target.
 *
 * Note: on a GitHub Pages *project* site this file lands at
 * /nestor-site/robots.txt, which crawlers ignore — robots.txt is only honoured
 * at the domain root. The `noindex` meta tag in Base.astro is what actually
 * keeps preview deploys out of search results.
 */
export const GET: APIRoute = ({ site }) => {
  const noindex = Boolean(import.meta.env.NOINDEX)

  const body = noindex
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', site ?? 'https://nestorhorizoneu.com').href}`,
        '',
      ].join('\n')

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
