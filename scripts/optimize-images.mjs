/**
 * Downscales and converts content images to WebP, then rewrites every
 * reference to them.
 *
 * The WordPress media library holds raw camera exports — one image is
 * 8256x5504 (45 megapixels, 14MB) and is displayed about 1200px wide. Nothing
 * in the design is rendered wider than 1300px, so anything beyond MAX_EDGE is
 * pure waste.
 *
 * Runs as part of `npm run content:pull`, immediately after the snapshot, so
 * it can never be forgotten. Idempotent: already-converted files are skipped.
 */
import sharp from 'sharp'
import { readdir, readFile, writeFile, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const MEDIA = path.join(ROOT, 'public/media')
const CONTENT = path.join(ROOT, 'src/content')

/** Longest edge to keep. 2400px covers the 1300px layout at ~2x for retina. */
const MAX_EDGE = 2400

const WEBP_OPTIONS = {
  quality: 80,
  // Flat graphics and logos suffer visibly at lossy alpha; keep it pristine.
  alphaQuality: 100,
  effort: 5,
}

const CONVERTIBLE = new Set(['.jpg', '.jpeg', '.png'])

/**
 * Left as-is on purpose:
 * - the favicon, because PNG has the broadest support for icon slots
 * - the site logo, which is referenced from src/config/site.ts rather than
 *   from content, so converting it would desync the config
 * Both are small enough not to matter.
 */
const SKIP = new Set([
  'cropped-NESTOR_LOGO_N-01-1.png',
  'NESTOR_LOGO_N-01-1.png',
  'Logo_Long-01.png',
])

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}K`

async function main() {
  const files = await readdir(MEDIA)

  /*
   * Reserve every existing name case-insensitively: Windows and macOS have
   * case-insensitive filesystems, and this library contains both `Elina-1.png`
   * and `elina-1.jpg`, which would otherwise both claim `elina-1.webp`.
   */
  const taken = new Set(files.map((f) => f.toLowerCase()))

  /** old filename -> new filename */
  const renames = new Map()
  let before = 0
  let after = 0
  let skipped = 0

  for (const file of files.sort()) {
    const ext = path.extname(file).toLowerCase()
    if (!CONVERTIBLE.has(ext) || SKIP.has(file)) continue

    const source = path.join(MEDIA, file)
    const originalSize = (await stat(source)).size

    let image = sharp(source, { failOn: 'none' })
    let meta
    try {
      meta = await image.metadata()
    } catch {
      console.warn(`  ! unreadable, left alone: ${file}`)
      continue
    }

    // Pick a collision-free .webp name.
    const stem = path.basename(file, path.extname(file))
    let candidate = `${stem}.webp`
    let n = 2
    while (taken.has(candidate.toLowerCase())) {
      candidate = `${stem}-${n}.webp`
      n++
    }

    /*
     * .rotate() bakes in EXIF orientation. Required: the encoder strips
     * metadata, so without this the phone photos would come out sideways.
     */
    image = image.rotate()

    const longest = Math.max(meta.width ?? 0, meta.height ?? 0)
    if (longest > MAX_EDGE) {
      // withoutEnlargement guards against ever upscaling a small asset.
      image = image.resize({
        width: meta.width >= meta.height ? MAX_EDGE : undefined,
        height: meta.height > meta.width ? MAX_EDGE : undefined,
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

    const buffer = await image.webp(WEBP_OPTIONS).toBuffer()

    // Only adopt the conversion when it's actually a win.
    if (buffer.length >= originalSize) {
      console.log(
        `  = kept original (webp was larger): ${file} ` +
          `[${kb(originalSize)} vs ${kb(buffer.length)}]`
      )
      before += originalSize
      after += originalSize
      skipped++
      continue
    }

    await writeFile(path.join(MEDIA, candidate), buffer)
    await unlink(source)

    taken.add(candidate.toLowerCase())
    renames.set(file, candidate)
    before += originalSize
    after += buffer.length

    const dims =
      longest > MAX_EDGE
        ? ` (${meta.width}x${meta.height} -> max ${MAX_EDGE}px)`
        : ''
    console.log(
      `  ${file} -> ${candidate}  ${kb(originalSize)} -> ${kb(buffer.length)}${dims}`
    )
  }

  if (renames.size === 0) {
    console.log('No images needed conversion.')
    return
  }

  // Rewrite every reference. Longest names first so no filename is a prefix
  // of another mid-replacement.
  const ordered = [...renames.entries()].sort((a, b) => b[0].length - a[0].length)

  for (const target of ['pages.json', 'posts.json', 'media.json', 'home.html']) {
    const file = path.join(CONTENT, target)
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch {
      continue
    }

    let hits = 0
    for (const [from, to] of ordered) {
      // Filenames land in JSON strings and in HTML src/srcset attributes;
      // matching on the media path covers all of them.
      const needle = `/media/${from}`
      if (!text.includes(needle)) continue
      hits += text.split(needle).length - 1
      text = text.replaceAll(needle, `/media/${to}`)
    }

    if (hits > 0) {
      await writeFile(file, text)
      console.log(`Rewrote ${hits} reference(s) in src/content/${target}`)
    }
  }

  const saved = before - after
  console.log(
    `\nConverted ${renames.size} image(s)` +
      (skipped ? `, kept ${skipped} original(s)` : '') +
      `: ${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB ` +
      `(${((saved / before) * 100).toFixed(0)}% smaller)`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
