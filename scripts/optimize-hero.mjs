/**
 * Produces the web-optimised hero video and poster frame from the original
 * WordPress upload.
 *
 * The source is a 56MB, 20Mbps, 1920x1080 H.264 file with no audio track —
 * roughly 24x larger than it needs to be for a muted background loop. The
 * outputs land in public/hero/ and ARE committed to the repo: public/media/ is
 * gitignored and wiped by `content:pull`, so derivatives can't live there.
 *
 * Requires ffmpeg on PATH. Run with: npm run hero:optimize
 */
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/hero')

const SOURCE_URL =
  'https://nestorhorizoneu.com/wp-content/uploads/2024/10/nestor2.mp4'
const LOCAL_SOURCE = path.join(ROOT, 'public/media/nestor2.mp4')
const SCRATCH = path.join(ROOT, 'public/hero/.source.mp4')

const VIDEO_OUT = path.join(OUT_DIR, 'nestor2-720.mp4')
const POSTER_OUT = path.join(OUT_DIR, 'nestor2-poster.jpg')

/** ffmpeg exits non-zero on failure; surface its stderr rather than swallowing it. */
function ffmpeg(args) {
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'inherit', 'inherit'],
    })
  } catch (err) {
    throw new Error(
      'ffmpeg failed. Is it installed and on PATH? ' +
        '(winget install Gyan.FFmpeg / brew install ffmpeg / apt install ffmpeg)'
    )
  }
}

async function resolveSource() {
  if (existsSync(LOCAL_SOURCE)) return LOCAL_SOURCE

  // The original is pruned from public/media/ once nothing references it.
  console.log('Original not found locally; downloading from WordPress...')
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`source download failed: ${res.status}`)
  await writeFile(SCRATCH, Buffer.from(await res.arrayBuffer()))
  return SCRATCH
}

const mb = async (file) => ((await stat(file)).size / 1048576).toFixed(2)

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const source = await resolveSource()

  console.log(`Source: ${await mb(source)}MB`)

  /*
   * 1280px wide is ample for a background that sits behind a 50% dim overlay.
   * CRF 28 is visually transparent at that scale; -an drops the (empty) audio
   * track; +faststart moves the moov atom up front so playback can begin
   * before the file finishes downloading.
   */
  console.log('Encoding 720p H.264...')
  ffmpeg([
    '-i', source,
    '-vf', 'scale=1280:-2',
    '-c:v', 'libx264',
    '-crf', '28',
    '-preset', 'slow',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    VIDEO_OUT,
  ])

  // Seek slightly in: frame 0 is often a near-black fade-in.
  console.log('Extracting poster frame...')
  ffmpeg([
    '-ss', '0.5',
    '-i', source,
    '-frames:v', '1',
    '-vf', 'scale=1280:-2',
    '-q:v', '3',
    POSTER_OUT,
  ])

  console.log('\nWrote:')
  console.log(`   public/hero/nestor2-720.mp4      ${await mb(VIDEO_OUT)}MB`)
  console.log(`   public/hero/nestor2-poster.jpg   ${await mb(POSTER_OUT)}MB`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
