import { readdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parsePgnGames } from './build-studies.js'

function stripHeaders(pgnText) {
  const lines = pgnText.replace(/\r\n/g, '\n').split('\n')
  let pastHeaders = false
  const body = []
  for (const line of lines) {
    if (!pastHeaders && line.trim().startsWith('[')) continue
    pastHeaders = true
    body.push(line)
  }
  return body.join('\n')
}

function tokenize(body) {
  return body
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.{1,3}/g, ' ')
    .replace(/\*|1-0|0-1|1\/2-1\/2/g, ' ')
    .replace(/([()])/g, ' $1 ')
    .split(/\s+/)
    .filter(t => t.length > 0)
}

function walkTokens(tokens, startIdx, prefix) {
  const paths = []
  let path = [...prefix]
  let i = startIdx

  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok === '(') {
      // drop the last move: the variation replaces it
      const varPrefix = path.slice(0, -1)
      const [subPaths, nextI] = walkTokens(tokens, i + 1, varPrefix)
      paths.push(...subPaths)
      i = nextI
    } else if (tok === ')') {
      if (path.length > 0) paths.push(path)
      return [paths, i + 1]
    } else {
      path = [...path, tok]
      i++
    }
  }

  paths.push(path)
  return [paths, i]
}

export function extractAllLeafPaths(pgnText) {
  const body = stripHeaders(pgnText)
  const tokens = tokenize(body)
  if (tokens.length === 0) return []

  const [allPaths] = walkTokens(tokens, 0, [])
  return allPaths.slice(0, -1)
}

function extractHeaders(pgnText) {
  return pgnText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => line.trim().startsWith('['))
}

export function formatLeafAsPgn(headers, moves) {
  const parts = []
  // assumes moves[0] is White's first move; index 0,2,4… = White
  moves.forEach((move, i) => {
    if (i % 2 === 0) parts.push(`${Math.floor(i / 2) + 1}.`)
    parts.push(move)
  })
  parts.push('*')
  return `${headers.join('\n')}\n\n${parts.join(' ')}`
}

export function extractVariations(pgnFilePath) {
  const content = readFileSync(pgnFilePath, 'utf8')
  const games = parsePgnGames(content)

  const allLeaves = []
  for (const pgn of games) {
    const leaves = extractAllLeafPaths(pgn)
    const headers = extractHeaders(pgn)
    for (const moves of leaves) {
      allLeaves.push({ headers, moves })
    }
  }

  if (allLeaves.length === 0) return []

  const dir = path.dirname(pgnFilePath)
  const stem = path.basename(pgnFilePath, '.pgn')
  const existing = readdirSync(dir).filter(f => f.startsWith(stem + '_var_') && f.endsWith('.pgn'))
  if (existing.length > 0) {
    throw new Error(
      `existing variation files found — delete them before re-running:\n${existing.map(f => '  ' + f).join('\n')}`
    )
  }

  const written = []
  allLeaves.forEach(({ headers, moves }, idx) => {
    const outName = `${stem}_var_${idx + 1}.pgn`
    const outPath = path.join(dir, outName)
    writeFileSync(outPath, formatLeafAsPgn(headers, moves))
    written.push(outPath)
  })

  return written
}
