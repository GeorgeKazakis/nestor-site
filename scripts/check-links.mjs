/**
 * Post-build integrity check: every root-relative href/src in dist/ must
 * resolve to a real file. Exits non-zero on the first broken reference, so it
 * can gate a deploy.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '../dist')

/*
 * With a base path the emitted URLs are prefixed (/nestor-site/about/) but the
 * files still sit at the dist root, so strip the prefix before resolving.
 */
const BASE = (process.env.BASE_PATH || '/').replace(/\/+$/, '')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    entry.isDirectory() ? walk(full, out) : out.push(full)
  }
  return out
}

const files = walk(DIST)
const htmlFiles = files.filter((f) => f.endsWith('.html'))

const resolves = (url) => {
  let clean = decodeURIComponent(url.split('#')[0].split('?')[0])

  if (BASE) {
    // Anything in-site must carry the base prefix; flag it if it doesn't.
    if (!clean.startsWith(`${BASE}/`) && clean !== BASE) return false
    clean = clean.slice(BASE.length) || '/'
  }

  return [
    path.join(DIST, clean),
    path.join(DIST, clean, 'index.html'),
  ].some((candidate) => existsSync(candidate))
}

const broken = new Map()

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    if (url.startsWith('//')) continue
    if (resolves(url)) continue
    if (!broken.has(url)) broken.set(url, [])
    broken.get(url).push(path.relative(DIST, file))
  }
}

const routes = htmlFiles
  .map((f) => '/' + path.relative(DIST, f).split(path.sep).join('/'))
  .map((r) => r.replace(/index\.html$/, ''))
  .sort()

console.log(`Checked ${htmlFiles.length} pages\n`)
console.log('Routes:')
for (const route of routes) console.log(`   ${route}`)

if (broken.size === 0) {
  console.log('\nNo broken references.')
} else {
  console.log(`\n${broken.size} broken reference(s):`)
  for (const [url, where] of broken) {
    console.log(`   ${url}  <- ${where.slice(0, 3).join(', ')}`)
  }
  process.exit(1)
}
