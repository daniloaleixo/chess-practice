// scripts/fetch-evals.js
// Fetches centipawn evaluations from Lichess Cloud Eval for every position in studies.json.
// Usage: node scripts/fetch-evals.js
// Re-running is safe — already-fetched FENs are skipped via cache.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT_PATH = path.join(__dirname, '..', 'public', 'studies.json')
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'studies-with-eval.json')
const RATE_LIMIT_MS = 1100

const input = JSON.parse(readFileSync(INPUT_PATH, 'utf8'))

const existing = existsSync(OUTPUT_PATH)
  ? JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
  : { chapters: [] }

const fenCache = new Map()
for (const chapter of existing.chapters) {
  for (const line of chapter.lines) {
    for (const pos of line.positions) {
      if (pos.cp !== null) fenCache.set(pos.fen, pos.cp)
    }
  }
}
console.log(`Loaded ${fenCache.size} cached FEN evaluations`)

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchEval(fen, retries = 3) {
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`
  try {
    const res = await fetch(url)
    if (res.status === 404) return null
    if (res.status === 429) {
      if (retries === 0) { console.warn(`  429 rate limit, giving up`); return null }
      const backoff = 10000 * (4 - retries)
      console.warn(`  429 rate limit, waiting ${backoff / 1000}s…`)
      await sleep(backoff)
      return fetchEval(fen, retries - 1)
    }
    if (!res.ok) { console.warn(`  HTTP ${res.status} for FEN: ${fen}`); return null }
    const data = await res.json()
    const pv = data.pvs?.[0]
    if (!pv) return null
    if (pv.mate !== undefined) return pv.mate > 0 ? 10000 : -10000
    return pv.cp ?? null
  } catch (e) {
    if (retries === 0) { console.warn(`  Fetch error: ${e.message}, giving up`); return null }
    await sleep(5000 * (4 - retries))
    return fetchEval(fen, retries - 1)
  }
}

const totalLines = input.chapters.reduce((n, ch) => n + ch.lines.length, 0)
let lineNum = 0
let fetched = 0
let skipped = 0
const resultChapters = []

for (const chapter of input.chapters) {
  const resultLines = []
  for (const line of chapter.lines) {
    lineNum++
    console.log(`\n[${lineNum}/${totalLines}] ${chapter.name}: ${line.pgn.slice(0, 50)}`)
    const positions = line.positions.map(p => ({ ...p, cp: null }))

    for (const pos of positions) {
      if (fenCache.has(pos.fen)) {
        pos.cp = fenCache.get(pos.fen)
        skipped++
      } else {
        pos.cp = await fetchEval(pos.fen)
        if (pos.cp !== null) fenCache.set(pos.fen, pos.cp)
        fetched++
        process.stdout.write(`  ${pos.move} → ${pos.cp ?? 'N/A'} cp\n`)
        await sleep(RATE_LIMIT_MS)
      }
    }
    resultLines.push({ ...line, positions })
  }
  resultChapters.push({ ...chapter, lines: resultLines })
  writeFileSync(OUTPUT_PATH, JSON.stringify({ chapters: resultChapters }, null, 2))
}

console.log(`\nDone. Fetched: ${fetched}, Skipped (cached): ${skipped}`)
console.log(`Output written to ${OUTPUT_PATH}`)
