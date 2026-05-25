import { Chess } from 'chess.js'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import path, { basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function parsePgnGames(content) {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n\n(?=\[)/)
    .map(s => s.trim())
    .filter(s => s.includes('[') && s.match(/\d+\./))
}

export function extractChapterName(pgnText, filename) {
  const match = pgnText.match(/\[Event "([^"]+)"\]/)
  const name = match?.[1]
  if (name && name !== '?') return name
  return filename
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function extractMainLine(pgnText) {
  const cleaned = pgnText.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
  const chess = new Chess()
  try {
    chess.loadPgn(cleaned)
  } catch (e) {
    console.warn(`  Warning: could not parse PGN (skipping): ${e.message}`)
    return []
  }
  const moves = chess.history()
  const game = new Chess()
  return moves.map(san => {
    game.move(san)
    return { fen: game.fen(), move: san, cp: null }
  })
}

function toChapterId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function buildStudies(
  studiesDir = path.join(__dirname, '..', 'studies'),
  outputPath = path.join(__dirname, '..', 'public', 'studies.json')
) {
  const files = readdirSync(studiesDir).filter(f => f.endsWith('.pgn')).sort()
  const chapters = []

  for (const file of files) {
    const content = readFileSync(path.join(studiesDir, file), 'utf8')
    const games = parsePgnGames(content)
    if (games.length === 0) continue

    const chapterName = extractChapterName(games[0], basename(file, '.pgn'))
    const chapterId = toChapterId(chapterName)

    const lines = games.map((pgn, i) => ({
      id: `${chapterId}-${i}`,
      pgn: pgn.replace(/\n+/g, ' ').trim(),
      positions: extractMainLine(pgn),
    }))

    chapters.push({ id: chapterId, name: chapterName, lines })
  }

  writeFileSync(outputPath, JSON.stringify({ chapters }, null, 2))
  console.log(`Wrote ${chapters.length} chapters to ${outputPath}`)
  return { chapters }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildStudies()
}
