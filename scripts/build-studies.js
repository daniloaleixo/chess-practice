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

function removeVariations(text) {
  let result = ''
  let depth = 0
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0) result += ch
  }
  return result
}

function parseArrow(s) {
  const colorMap = { R: 'red', G: 'green', Y: 'yellow', B: 'blue' }
  const m = s.trim().match(/^([RGYB])([a-h][1-8])([a-h][1-8])$/)
  if (!m) return null
  return { from: m[2], to: m[3], color: colorMap[m[1]] ?? m[1] }
}

function parseSquare(s) {
  const colorMap = { R: 'red', G: 'green', Y: 'yellow', B: 'blue' }
  const m = s.trim().match(/^([RGYB])([a-h][1-8])$/)
  if (!m) return null
  return { square: m[2], color: colorMap[m[1]] ?? m[1] }
}

function countMovesInSegment(text) {
  const cleaned = text
    .replace(/\d+\.\.{0,2}/g, '')   // move numbers: 1. 2... 11.
    .replace(/\*|1-0|0-1|1\/2-1\/2/g, '')  // game results
    .replace(/\$\d+/g, '')          // NAGs
    .trim()
  if (!cleaned) return 0
  return cleaned.split(/\s+/).filter(t => t.length > 0).length
}

export function extractMoveAnnotations(pgnText) {
  if (!pgnText || !pgnText.trim()) return []
  // Strip PGN headers (lines starting with '[') without touching comment content
  const lines = pgnText.replace(/\r\n/g, '\n').split('\n')
  const bodyLines = []
  let pastHeaders = false
  for (const line of lines) {
    if (!pastHeaders && line.trim().startsWith('[')) continue
    pastHeaders = true
    bodyLines.push(line)
  }
  const body = bodyLines.join('\n').trim()
  const flat = removeVariations(body)
  const parts = flat.split(/(\{[^}]*\})/)

  const raw = {}
  let moveIndex = 0

  for (const part of parts) {
    if (part.startsWith('{') && part.endsWith('}')) {
      if (moveIndex > 0) {
        const idx = moveIndex - 1
        if (!raw[idx]) raw[idx] = { texts: [], arrowsRaw: [], squaresRaw: [] }
        const commentText = part.slice(1, -1)
        const arrowMatch = commentText.match(/\[%cal ([^\]]+)\]/)
        const squareMatch = commentText.match(/\[%csl ([^\]]+)\]/)
        const text = commentText.replace(/\[%[^\]]+\]/g, '').trim()
        if (text) raw[idx].texts.push(text)
        if (arrowMatch) raw[idx].arrowsRaw.push(...arrowMatch[1].split(','))
        if (squareMatch) raw[idx].squaresRaw.push(...squareMatch[1].split(','))
      }
    } else {
      moveIndex += countMovesInSegment(part)
    }
  }

  return Array.from({ length: moveIndex }, (_, i) => {
    const a = raw[i]
    if (!a || (a.texts.length === 0 && a.arrowsRaw.length === 0 && a.squaresRaw.length === 0)) return null
    return {
      text: a.texts.join(' ').trim() || null,
      arrows: a.arrowsRaw.map(parseArrow).filter(Boolean),
      squares: a.squaresRaw.map(parseSquare).filter(Boolean),
    }
  })
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
  const annotations = extractMoveAnnotations(pgnText)
  const game = new Chess()
  return moves.map((san, i) => {
    game.move(san)
    return { fen: game.fen(), move: san, cp: null, annotation: annotations[i] ?? null }
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
