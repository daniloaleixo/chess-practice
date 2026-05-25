# Listudy-Style Chess Practice App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the chess practice app with PGN-file-based chapters, localStorage spaced repetition, Lichess centipawn evals, and a hint button — matching the listudy.org study experience.

**Architecture:** A pre-build Node.js script (`build-studies.js`) reads PGN files from `studies/` and outputs `public/studies.json`; a second script (`fetch-evals.js`) adds Lichess centipawn evals to produce `public/studies-with-eval.json`. The React app loads this file, renders a sidebar of chapters with progress bars, and drills lines within the active chapter using weighted random selection (score stored in localStorage).

**Tech Stack:** React 19, Vite, chess.js, react-chessboard, vitest, localStorage

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `studies/*.pgn` | New (user-managed) | One PGN file per chapter |
| `scripts/build-studies.js` | New | Parse PGNs → `public/studies.json` |
| `scripts/build-studies.test.js` | New | Tests for PGN parsing functions |
| `scripts/fetch-evals.js` | Rewrite | Read `studies.json`, write `studies-with-eval.json` |
| `public/studies.json` | Generated | Chapters + lines (no eval) |
| `public/studies-with-eval.json` | Generated | Chapters + lines + cp per position |
| `src/useProgress.js` | New | localStorage read/write hook |
| `src/useProgress.test.js` | New | Tests for progress hook |
| `src/useDrill.js` | Rewrite | Chapter-aware drill: weighted random + hint |
| `src/useDrill.test.js` | Rewrite | Tests for new drill API |
| `src/Sidebar.jsx` | New | Chapter list with progress bars |
| `src/PracticeBoard.jsx` | Rewrite | Hint button, line counter, wires useProgress |
| `src/App.jsx` | Rewrite | Sidebar layout, loads studies-with-eval.json |
| `src/index.css` | Update | Sidebar and hint button styles |

---

### Task 1: Create studies directory with sample PGN

**Files:**
- Create: `studies/london-vs-dutch.pgn`

- [ ] **Step 1: Create the studies directory and a sample PGN file**

Create `studies/london-vs-dutch.pgn`:

```pgn
[Event "London vs Dutch"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]

1. d4 f5 2. Bf4 Nf6 3. e3 e6 4. Nf3 d5 5. Bd3 Bd6 6. Bg3 O-O 7. O-O c5 8. c3 *

[Event "London vs Dutch"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]

1. d4 f5 2. Nf3 Nf6 3. Bf4 e6 4. e3 d5 5. Bd3 c5 6. c3 Nc6 7. O-O *
```

- [ ] **Step 2: Commit**

```bash
git add studies/
git commit -m "feat: add studies directory with sample London vs Dutch PGN"
```

---

### Task 2: Implement build-studies.js (TDD)

**Files:**
- Create: `scripts/build-studies.js`
- Create: `scripts/build-studies.test.js`

- [ ] **Step 1: Write failing tests**

Create `scripts/build-studies.test.js`:

```js
import { parsePgnGames, extractChapterName, extractMainLine } from './build-studies.js'

describe('parsePgnGames', () => {
  it('splits a PGN file with two games', () => {
    const content = '[Event "Game 1"]\n\n1. d4 d5 *\n\n[Event "Game 2"]\n\n1. e4 e5 *'
    const games = parsePgnGames(content)
    expect(games).toHaveLength(2)
    expect(games[0]).toContain('[Event "Game 1"]')
    expect(games[1]).toContain('[Event "Game 2"]')
  })

  it('returns a single-element array when file has one game', () => {
    const content = '[Event "Game 1"]\n\n1. d4 d5 *'
    expect(parsePgnGames(content)).toHaveLength(1)
  })
})

describe('extractChapterName', () => {
  it('extracts name from [Event] tag', () => {
    const pgn = '[Event "London vs Dutch"]\n\n1. d4 f5 *'
    expect(extractChapterName(pgn, 'irrelevant')).toBe('London vs Dutch')
  })

  it('falls back to filename when Event tag is absent', () => {
    const pgn = '[Site "?"]\n\n1. d4 f5 *'
    expect(extractChapterName(pgn, 'london-vs-dutch')).toBe('London Vs Dutch')
  })

  it('falls back to filename when Event tag is "?"', () => {
    const pgn = '[Event "?"]\n\n1. d4 f5 *'
    expect(extractChapterName(pgn, 'london-vs-kid')).toBe('London Vs Kid')
  })
})

describe('extractMainLine', () => {
  it('extracts positions for a simple line', () => {
    const pgn = '[Event "Test"]\n\n1. d4 d5 *'
    const positions = extractMainLine(pgn)
    expect(positions).toHaveLength(2)
    expect(positions[0].move).toBe('d4')
    expect(positions[1].move).toBe('d5')
    expect(positions[0].fen).toMatch(/^[rnbqkbnrpRNBQKBNRP1-8\/]+ [wb]/)
  })

  it('ignores variations in parentheses', () => {
    const pgn = '[Event "Test"]\n\n1. d4 (1. e4 e5) 1... d5 *'
    const positions = extractMainLine(pgn)
    expect(positions.map(p => p.move)).toEqual(['d4', 'd5'])
  })

  it('returns all positions up to the last move', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 2. Bf4 e6 3. Nf3 *'
    const positions = extractMainLine(pgn)
    expect(positions).toHaveLength(5)
    expect(positions[4].move).toBe('Nf3')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- scripts/build-studies.test.js
```

Expected: FAIL with "Cannot find module './build-studies.js'"

- [ ] **Step 3: Implement build-studies.js**

Create `scripts/build-studies.js`:

```js
import { Chess } from 'chess.js'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'

export function parsePgnGames(content) {
  return content
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
  const chess = new Chess()
  chess.loadPgn(pgnText)
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

export function buildStudies(studiesDir = 'studies', outputPath = 'public/studies.json') {
  const files = readdirSync(studiesDir).filter(f => f.endsWith('.pgn')).sort()
  const chapters = []

  for (const file of files) {
    const content = readFileSync(join(studiesDir, file), 'utf8')
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- scripts/build-studies.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Run the script to generate public/studies.json**

```bash
node scripts/build-studies.js
```

Expected output:
```
Wrote 1 chapters to public/studies.json
```

- [ ] **Step 6: Commit**

```bash
git add scripts/build-studies.js scripts/build-studies.test.js public/studies.json
git commit -m "feat: add build-studies.js to parse PGN chapters into studies.json"
```

---

### Task 3: Rewrite fetch-evals.js for new chapter structure

**Files:**
- Rewrite: `scripts/fetch-evals.js`

- [ ] **Step 1: Replace fetch-evals.js**

```js
// scripts/fetch-evals.js
// Fetches centipawn evaluations from Lichess Cloud Eval for every position in studies.json.
// Usage: node scripts/fetch-evals.js
// Re-running is safe — already-fetched FENs are skipped via cache.

import { readFileSync, writeFileSync, existsSync } from 'fs'

const INPUT_PATH = 'public/studies.json'
const OUTPUT_PATH = 'public/studies-with-eval.json'
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
```

- [ ] **Step 2: Verify the script reads studies.json correctly**

```bash
node scripts/fetch-evals.js 2>&1 | head -4
```

Expected (press Ctrl+C after a few seconds — full run takes time with real study files):
```
Loaded 0 cached FEN evaluations

[1/2] London vs Dutch: [Event "London vs Dutch"] [Site "?"] [Date
  d4 → ...
```

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-evals.js
git commit -m "feat: rewrite fetch-evals.js for chapter-based studies.json structure"
```

---

### Task 4: Implement useProgress.js (TDD)

**Files:**
- Create: `src/useProgress.js`
- Create: `src/useProgress.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/useProgress.test.js`:

```js
import { renderHook, act } from '@testing-library/react'
import { useProgress } from './useProgress'

const mockChapter = {
  id: 'london-vs-dutch',
  name: 'London vs Dutch',
  lines: [
    { id: 'london-vs-dutch-0', pgn: '', positions: [] },
    { id: 'london-vs-dutch-1', pgn: '', positions: [] },
    { id: 'london-vs-dutch-2', pgn: '', positions: [] },
  ],
}

beforeEach(() => localStorage.clear())

describe('useProgress', () => {
  it('getScore returns 0 for unseen lines', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getScore('london-vs-dutch-0')).toBe(0)
  })

  it('setScore persists score and getScore returns it', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setScore('london-vs-dutch-0', 2))
    expect(result.current.getScore('london-vs-dutch-0')).toBe(2)
  })

  it('setScore writes to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setScore('london-vs-dutch-0', 1))
    const stored = JSON.parse(localStorage.getItem('chess-practice:progress'))
    expect(stored['london-vs-dutch-0']).toBe(1)
  })

  it('getMasteredCount returns 0 when no lines mastered', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getMasteredCount(mockChapter)).toBe(0)
  })

  it('getMasteredCount counts lines with score >= 3', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setScore('london-vs-dutch-0', 3)
      result.current.setScore('london-vs-dutch-1', 5)
      result.current.setScore('london-vs-dutch-2', 2)
    })
    expect(result.current.getMasteredCount(mockChapter)).toBe(2)
  })

  it('resetChapter clears scores for that chapter', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setScore('london-vs-dutch-0', 3)
      result.current.setScore('london-vs-dutch-1', 1)
    })
    act(() => result.current.resetChapter('london-vs-dutch'))
    expect(result.current.getScore('london-vs-dutch-0')).toBe(0)
    expect(result.current.getScore('london-vs-dutch-1')).toBe(0)
  })

  it('resetChapter does not touch scores from other chapters', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setScore('london-vs-dutch-0', 3)
      result.current.setScore('london-vs-kid-0', 2)
    })
    act(() => result.current.resetChapter('london-vs-dutch'))
    expect(result.current.getScore('london-vs-kid-0')).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/useProgress.test.js
```

Expected: FAIL with "Cannot find module './useProgress'"

- [ ] **Step 3: Implement useProgress.js**

Create `src/useProgress.js`:

```js
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'chess-practice:progress'

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress)

  const getScore = useCallback((lineId) => progress[lineId] ?? 0, [progress])

  const setScore = useCallback((lineId, score) => {
    setProgress(prev => {
      const next = { ...prev, [lineId]: score }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getMasteredCount = useCallback(
    (chapter) => chapter.lines.filter(l => (progress[l.id] ?? 0) >= 3).length,
    [progress]
  )

  const resetChapter = useCallback((chapterId) => {
    setProgress(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(chapterId + '-')) delete next[key]
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { getScore, setScore, getMasteredCount, resetChapter }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/useProgress.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/useProgress.js src/useProgress.test.js
git commit -m "feat: add useProgress hook for localStorage spaced repetition tracking"
```

---

### Task 5: Rewrite useDrill.js — chapter-aware, weighted random, hint

**Files:**
- Rewrite: `src/useDrill.js`
- Rewrite: `src/useDrill.test.js`

- [ ] **Step 1: Write failing tests**

Replace `src/useDrill.test.js` entirely:

```js
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useDrill } from './useDrill'

// After 1. d4: FEN rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1
// After 1. d4 d5: FEN rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2
const line1 = {
  id: 'london-vs-dutch-0',
  pgn: '1. d4 d5',
  positions: [
    { fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', move: 'd4', cp: 15 },
    { fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', move: 'd5', cp: 10 },
  ],
}

// After 1. d4 Nf6: FEN rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2
// After 1. d4 Nf6 2. c4: FEN rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2
const line2 = {
  id: 'london-vs-dutch-1',
  pgn: '1. d4 Nf6 2. c4',
  positions: [
    { fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', move: 'd4', cp: 15 },
    { fen: 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2', move: 'Nf6', cp: 10 },
    { fen: 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2', move: 'c4', cp: 20 },
  ],
}

function makeChapter(lines) {
  return { id: 'london-vs-dutch', name: 'London vs Dutch', lines }
}

describe('useDrill', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts with isUserTurn true and empty moveHistory', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    expect(result.current.isUserTurn).toBe(true)
    expect(result.current.moveHistory).toHaveLength(0)
  })

  it('exposes totalLines and currentLineIndex', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1, line2]), getScore, setScore))
    expect(result.current.totalLines).toBe(2)
    expect(result.current.currentLineIndex).toBeGreaterThanOrEqual(0)
    expect(result.current.currentLineIndex).toBeLessThan(2)
  })

  it('returns correct: true when user plays the expected White move', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    let response
    act(() => { response = result.current.handleUserMove('d2', 'd4') })
    expect(response.correct).toBe(true)
  })

  it('returns correct: false and provides correctMove on wrong move', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    let response
    act(() => { response = result.current.handleUserMove('e2', 'e4') })
    expect(response.correct).toBe(false)
    expect(response.correctMove).toBe('d4')
  })

  it('calls setScore(lineId, 0) on wrong move', () => {
    const getScore = vi.fn(() => 2)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    act(() => { result.current.handleUserMove('e2', 'e4') })
    expect(setScore).toHaveBeenCalledWith(line1.id, 0)
  })

  it('calls setScore(lineId, score+1) when full line is completed', () => {
    const getScore = vi.fn(() => 1)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(setScore).toHaveBeenCalledWith(line1.id, 2)
  })

  it('advances moveHistory to include White and Black moves after correct White move', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line2]), getScore, setScore))
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(result.current.moveHistory).toContain('d4')
    expect(result.current.moveHistory).toContain('Nf6')
  })

  it('updates currentCp to the last played position cp value', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    expect(result.current.currentCp).toBe(0)
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(result.current.currentCp).toBe(10)
  })

  it('hint() returns the expected SAN without triggering setScore on completion', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    let hintMove
    act(() => { hintMove = result.current.hint() })
    expect(hintMove).toBe('d4')
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(setScore).not.toHaveBeenCalled()
  })

  it('restartCurrentLine resets board to start without picking a new line', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    const indexBefore = result.current.currentLineIndex
    act(() => { result.current.handleUserMove('d2', 'd4') })
    act(() => { result.current.restartCurrentLine() })
    expect(result.current.moveHistory).toHaveLength(0)
    expect(result.current.currentLineIndex).toBe(indexBefore)
    expect(result.current.isUserTurn).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/useDrill.test.js
```

Expected: Multiple failures (old API)

- [ ] **Step 3: Implement new useDrill.js**

Replace `src/useDrill.js` entirely:

```js
import { useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'

function pickWeightedRandom(lines, getScore) {
  const weights = lines.map(l => 1 / (getScore(l.id) + 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < lines.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return lines.length - 1
}

function initLine(chapter, getScore, lineIndex = null) {
  const idx = lineIndex ?? pickWeightedRandom(chapter.lines, getScore)
  const line = chapter.lines[idx]
  const moves = line.positions.map(p => p.move.replace('0-0-0', 'O-O-O').replace('0-0', 'O-O'))
  const cps = line.positions.map(p => p.cp ?? 0)
  const chess = new Chess()
  return { chess, moves, cps, moveIndex: 0, lineId: line.id, lineIndex: idx }
}

export function useDrill(chapter, getScore, setScore) {
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = initLine(chapter, getScore)
  }

  const [fen, setFen] = useState(() => stateRef.current.chess.fen())
  const [moveHistory, setMoveHistory] = useState([])
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [currentCp, setCurrentCp] = useState(0)
  const [lineIndex, setLineIndex] = useState(() => stateRef.current.lineIndex)
  const hintUsedRef = useRef(false)

  const startNewLine = useCallback(() => {
    const next = initLine(chapter, getScore)
    stateRef.current = next
    hintUsedRef.current = false
    setFen(next.chess.fen())
    setMoveHistory([])
    setCurrentCp(0)
    setLineIndex(next.lineIndex)
    setIsUserTurn(true)
  }, [chapter, getScore])

  const restartCurrentLine = useCallback(() => {
    const { lineIndex: idx } = stateRef.current
    const next = initLine(chapter, getScore, idx)
    stateRef.current = next
    hintUsedRef.current = false
    setFen(next.chess.fen())
    setMoveHistory([])
    setCurrentCp(0)
    setIsUserTurn(true)
  }, [chapter, getScore])

  const applyBlackMoves = useCallback((chess, moves, cps, startIdx) => {
    let idx = startIdx
    while (idx < moves.length && idx % 2 === 1) {
      chess.move(moves[idx])
      idx++
    }

    if (idx >= moves.length) {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      if (!hintUsedRef.current) {
        setScore(stateRef.current.lineId, getScore(stateRef.current.lineId) + 1)
      }
      setIsUserTurn(false)
      setTimeout(() => startNewLine(), 2000)
    } else {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      stateRef.current.moveIndex = idx
      setIsUserTurn(true)
    }
  }, [getScore, setScore, startNewLine])

  const handleUserMove = useCallback((from, to) => {
    const { chess, moves, cps, moveIndex } = stateRef.current
    if (moveIndex % 2 !== 0) return { correct: false, correctMove: null }

    const expectedSan = moves[moveIndex]
    const tempChess = new Chess(chess.fen())
    const attempted = tempChess.move({ from, to, promotion: 'q' })

    if (!attempted || attempted.san !== expectedSan) {
      setScore(stateRef.current.lineId, 0)
      return { correct: false, correctMove: expectedSan }
    }

    chess.move({ from, to, promotion: 'q' })
    stateRef.current.moveIndex = moveIndex + 1
    applyBlackMoves(chess, moves, cps, moveIndex + 1)
    return { correct: true, correctMove: null }
  }, [applyBlackMoves, setScore])

  const hint = useCallback(() => {
    hintUsedRef.current = true
    return stateRef.current.moves[stateRef.current.moveIndex] ?? null
  }, [])

  const { moves, moveIndex } = stateRef.current
  const expectedMove = moves[moveIndex] ?? ''

  return {
    fen,
    moveHistory,
    isUserTurn,
    expectedMove,
    currentCp,
    currentLineIndex: lineIndex,
    totalLines: chapter.lines.length,
    handleUserMove,
    hint,
    restartCurrentLine,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/useDrill.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/useDrill.js src/useDrill.test.js
git commit -m "feat: rewrite useDrill with chapter-aware weighted selection and hint"
```

---

### Task 6: Implement Sidebar.jsx

**Files:**
- Create: `src/Sidebar.jsx`

- [ ] **Step 1: Create Sidebar.jsx**

```jsx
export function Sidebar({ chapters, getMasteredCount, activeChapterId, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">CHAPTERS</div>
      {chapters.map(chapter => {
        const mastered = getMasteredCount(chapter)
        const total = chapter.lines.length
        const pct = total > 0 ? (mastered / total) * 100 : 0
        const isActive = chapter.id === activeChapterId
        return (
          <div
            key={chapter.id}
            className={`sidebar-chapter${isActive ? ' sidebar-chapter--active' : ''}`}
            onClick={() => onSelect(chapter.id)}
          >
            <div className="sidebar-chapter-name">{chapter.name}</div>
            <div className="sidebar-progress-bar">
              <div className="sidebar-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="sidebar-chapter-count">{mastered}/{total} mastered</div>
          </div>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/Sidebar.jsx
git commit -m "feat: add Sidebar component with chapter list and progress bars"
```

---

### Task 7: Rewrite PracticeBoard.jsx — hint button + line counter

**Files:**
- Rewrite: `src/PracticeBoard.jsx`

- [ ] **Step 1: Replace PracticeBoard.jsx**

```jsx
import { useState, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { useDrill } from './useDrill'
import { useProgress } from './useProgress'

const FEEDBACK_DURATION_MS = 1500

export function PracticeBoard({ chapter }) {
  const { getScore, setScore } = useProgress()
  const {
    fen,
    moveHistory,
    isUserTurn,
    expectedMove,
    currentCp,
    currentLineIndex,
    totalLines,
    handleUserMove,
    hint,
    restartCurrentLine,
  } = useDrill(chapter, getScore, setScore)

  const [feedback, setFeedback] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [hintSan, setHintSan] = useState(null)
  const lockedRef = useRef(false)
  const feedbackTimerRef = useRef(null)

  const tryMove = useCallback((sourceSquare, targetSquare) => {
    if (!isUserTurn || lockedRef.current) return false
    setHintSan(null)

    const result = handleUserMove(sourceSquare, targetSquare)

    if (result.correct) {
      setFeedback({ correct: true, message: 'Correct!' })
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS)
      return true
    } else {
      lockedRef.current = true
      setFeedback({ correct: false, message: `Wrong! Correct move: ${result.correctMove}` })
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => {
        lockedRef.current = false
        setFeedback(null)
        restartCurrentLine()
      }, FEEDBACK_DURATION_MS)
      return false
    }
  }, [isUserTurn, handleUserMove, restartCurrentLine])

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    setSelectedSquare(null)
    return tryMove(sourceSquare, targetSquare)
  }, [tryMove])

  const onSquareClick = useCallback(({ piece, square }) => {
    if (!isUserTurn || lockedRef.current) return
    if (piece) {
      setSelectedSquare(prev => prev === square ? null : square)
      return
    }
    if (selectedSquare) {
      tryMove(selectedSquare, square)
      setSelectedSquare(null)
    }
  }, [selectedSquare, isUserTurn, tryMove])

  const onHintClick = useCallback(() => {
    const san = hint()
    if (san) setHintSan(san)
  }, [hint])

  const squareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(255,255,0,0.4)' } }
    : {}

  const moveNotation = moveHistory
    .map((move, i) => i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${move}` : move)
    .join(' ')

  const nextMoveLabel = isUserTurn && expectedMove
    ? `${Math.floor(moveHistory.length / 2) + 1}. ?`
    : ''

  const evalPercent = Math.min(100, Math.max(0, 50 + currentCp / 100))

  return (
    <div className="practice-board">
      <div className="practice-header">
        <span className="practice-chapter-name">{chapter.name}</span>
        <span className="practice-line-counter">Line {currentLineIndex + 1} of {totalLines}</span>
      </div>

      <div className="move-notation">
        {moveNotation || 'Game start'}
        {nextMoveLabel && <span className="expected-move"> {nextMoveLabel}</span>}
      </div>

      <div className="board-area">
        <div className="eval-bar">
          <div className="eval-bar-white" style={{ height: `${evalPercent}%` }} />
        </div>
        <div className="board-wrapper">
          <Chessboard
            options={{
              position: fen,
              allowDragging: isUserTurn && !lockedRef.current,
              onPieceDrop,
              onSquareClick,
              squareStyles,
              boardStyle: { width: '480px', height: '480px' },
            }}
          />
        </div>
      </div>

      <div className="below-board">
        <span className={`eval-score ${currentCp >= 0 ? 'eval-white' : 'eval-black'}`}>
          {currentCp >= 0 ? '+' : ''}{(currentCp / 100).toFixed(2)}
        </span>
        <button
          className="hint-button"
          onClick={onHintClick}
          disabled={!isUserTurn || lockedRef.current}
        >
          💡 Hint
        </button>
      </div>

      {hintSan && (
        <div className="hint-text">Hint: play <strong>{hintSan}</strong></div>
      )}

      {!isUserTurn && (
        <div className="feedback feedback--correct">Line complete! ✓</div>
      )}

      {isUserTurn && feedback && (
        <div className={`feedback ${feedback.correct ? 'feedback--correct' : 'feedback--wrong'}`}>
          {feedback.message}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/PracticeBoard.jsx
git commit -m "feat: rewrite PracticeBoard with hint button and line counter"
```

---

### Task 8: Rewrite App.jsx — sidebar layout

**Files:**
- Rewrite: `src/App.jsx`

- [ ] **Step 1: Replace App.jsx**

```jsx
import { useState, useEffect } from 'react'
import { PracticeBoard } from './PracticeBoard'
import { Sidebar } from './Sidebar'
import { useProgress } from './useProgress'

export default function App() {
  const [chapters, setChapters] = useState(null)
  const [activeChapterId, setActiveChapterId] = useState(null)
  const [error, setError] = useState(null)
  const { getMasteredCount } = useProgress()

  useEffect(() => {
    fetch('/studies-with-eval.json')
      .then(r => r.json())
      .then(data => {
        setChapters(data.chapters)
        if (data.chapters.length > 0) setActiveChapterId(data.chapters[0].id)
      })
      .catch(() => setError('Failed to load studies-with-eval.json. Run build-studies.js and fetch-evals.js first.'))
  }, [])

  if (error) return <div className="status-message">{error}</div>
  if (!chapters) return <div className="status-message">Loading…</div>
  if (chapters.length === 0) return <div className="status-message">No chapters found. Add .pgn files to studies/ and run node scripts/build-studies.js.</div>

  const activeChapter = chapters.find(c => c.id === activeChapterId) ?? chapters[0]

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">♟ Chess Practice</span>
      </header>
      <div className="app-body">
        <Sidebar
          chapters={chapters}
          getMasteredCount={getMasteredCount}
          activeChapterId={activeChapterId}
          onSelect={setActiveChapterId}
        />
        <main className="app-main">
          <PracticeBoard key={activeChapterId} chapter={activeChapter} />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: rewrite App with sidebar layout and chapter-based PracticeBoard"
```

---

### Task 9: Update CSS for sidebar layout and hint button

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the `.app` rule and append new styles to src/index.css**

Find and replace the `.app` rule (currently `display: flex; flex-direction: column; align-items: center`):

```css
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
```

Then append to the end of `src/index.css`:

```css
/* Two-column layout */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 32px 16px;
  overflow-y: auto;
}

/* Sidebar */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #16213e;
  padding: 16px 12px;
  overflow-y: auto;
  border-right: 1px solid #2a2a4a;
}

.sidebar-title {
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #a0c4ff;
  font-weight: bold;
  margin-bottom: 12px;
}

.sidebar-chapter {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.sidebar-chapter:hover {
  background: #1e2d50;
}

.sidebar-chapter--active {
  background: #0f3460;
}

.sidebar-chapter-name {
  font-size: 13px;
  color: #ccc;
  margin-bottom: 4px;
}

.sidebar-chapter--active .sidebar-chapter-name {
  color: #fff;
}

.sidebar-progress-bar {
  height: 3px;
  background: #1a3a5c;
  border-radius: 2px;
  margin-bottom: 3px;
}

.sidebar-progress-fill {
  height: 100%;
  background: #4ecca3;
  border-radius: 2px;
  transition: width 0.3s;
}

.sidebar-chapter-count {
  font-size: 11px;
  color: #555;
}

.sidebar-chapter--active .sidebar-chapter-count {
  color: #4ecca3;
}

/* Practice board header */
.practice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 4px;
}

.practice-chapter-name {
  font-size: 16px;
  font-weight: bold;
  color: #a0c4ff;
}

.practice-line-counter {
  font-size: 12px;
  color: #4ecca3;
}

/* Board + eval bar side by side */
.board-area {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.eval-bar {
  width: 14px;
  height: 480px;
  background: #222;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column-reverse;
}

.eval-bar-white {
  background: #f0f0f0;
  width: 100%;
  transition: height 0.4s;
}

/* Eval score + hint button row */
.below-board {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 480px;
  margin-top: 8px;
}

/* Hint */
.hint-button {
  background: #f9c74f;
  color: #1a1a2e;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: opacity 0.15s;
}

.hint-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.hint-button:not(:disabled):hover {
  opacity: 0.85;
}

.hint-text {
  font-size: 13px;
  color: #f9c74f;
  margin-top: 4px;
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: All tests PASS (build-studies, useProgress, useDrill)

- [ ] **Step 3: Start dev server and do a manual smoke test**

```bash
npm run dev
```

Open http://localhost:5173. Verify:
- Sidebar visible on the left with "London vs Dutch" chapter, showing 0/2 mastered
- Board on the right with "London vs Dutch" header and "Line 1 of 2"
- Playing d4 correctly advances the board; Black responds automatically
- Playing a wrong move shows red feedback and resets the line
- Clicking Hint shows the expected move in text
- After hint, completing the line does NOT increment the score in localStorage
- After 3 correct completions (no hint), chapter shows 1/2 mastered

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: update CSS for sidebar layout and hint button"
```

---

### Task 10: Add real study files and generate studies-with-eval.json

**Files:**
- Add: `studies/*.pgn` (your real PGN files)
- Generated: `public/studies-with-eval.json`

- [ ] **Step 1: Drop your real PGN files into studies/**

Each file is one chapter. Each game in the file is one line (main line only — variations are stripped). Make sure each game has `[Event "Chapter Name"]` at the top.

- [ ] **Step 2: Rebuild studies.json**

```bash
node scripts/build-studies.js
```

Expected: JSON updated, e.g. "Wrote 5 chapters to public/studies.json"

- [ ] **Step 3: Fetch evals (runs in background; safe to interrupt and resume)**

```bash
node scripts/fetch-evals.js
```

Expected: `public/studies-with-eval.json` created with `cp` values filled in progressively. Can be interrupted and resumed — cached FENs are skipped.

- [ ] **Step 4: Verify all chapters appear in the app**

Open http://localhost:5173. Confirm all chapters show in the sidebar with correct line counts and that eval bars update as you play.

- [ ] **Step 5: Commit**

```bash
git add public/studies-with-eval.json studies/
git commit -m "feat: add real study PGN files and studies-with-eval.json"
```
