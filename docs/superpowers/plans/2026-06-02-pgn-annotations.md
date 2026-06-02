# PGN Annotations Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface per-move PGN annotations (text comments, arrows, colored squares) in the chess practice app — text in the Sidebar, arrows/squares on the board — shown before each move, with a toggle to hide them.

**Architecture:** Annotations are extracted during the build step (`build-studies.js`) and stored per-position in the JSON. `useDrill` exposes `currentAnnotation` (the annotation for the next move to play). `PracticeBoard` calls an `onAnnotationChange` callback so `App` can relay the text portion to `Sidebar`; `PracticeBoard` itself conditionally passes arrows/squares into the Chessboard `options`. A `showAnnotations` boolean lives in `useProgress` alongside the existing chunk settings.

**Tech Stack:** Vite + React 19, chess.js 1.4, react-chessboard 5, Vitest

---

## File Map

| File | What changes |
|------|-------------|
| `scripts/build-studies.js` | Add `removeVariations`, `parseArrow`, `parseSquare`, `countMovesInSegment`, `extractMoveAnnotations`; update `extractMainLine` to add `annotation` field |
| `scripts/build-studies.test.js` | Tests for `extractMoveAnnotations` |
| `public/studies.json` | Rebuilt (annotation field per position) |
| `public/studies-with-eval.json` | Rebuilt (annotation field preserved via spread in fetch-evals.js) |
| `src/useDrill.js` | `initLine` extracts `allAnnotations`; expose `currentAnnotation` in return |
| `src/useDrill.test.js` | Tests for `currentAnnotation` |
| `src/useProgress.js` | `DEFAULT_CHUNK_SETTINGS` adds `showAnnotations: true`; `setChunkSettings` persists it |
| `src/useProgress.test.js` | Tests for `showAnnotations` default and persistence |
| `src/App.jsx` | Add `currentAnnotation` state; pass `onAnnotationChange` to PracticeBoard; pass `currentAnnotation` and `showAnnotations` to Sidebar and PracticeBoard |
| `src/PracticeBoard.jsx` | Accept `onAnnotationChange` + `showAnnotations`; fire callback on annotation change; pass arrows/squares to Chessboard |
| `src/Sidebar.jsx` | Accept `currentAnnotation`; render `.annotation-text` panel; add `showAnnotations` toggle to settings panel |
| `src/index.css` | Styles for `.annotation-text` |

---

## Task 1: Annotation extraction in build pipeline

**Files:**
- Modify: `scripts/build-studies.js`
- Modify: `scripts/build-studies.test.js`

### How chess.js comment parsing works (important context)

chess.js 1.x **cannot parse consecutive `{ }` comment blocks** — loading a PGN like `1. d4 { text } { [%cal ...] } *` throws a syntax error. That is why `extractMainLine` already strips comments before loading. We write our own annotation extractor that reads the **raw PGN** (before comment stripping) and is run in parallel with chess.js's move parsing.

- [ ] **Step 1: Write failing tests for `extractMoveAnnotations`**

Add to `scripts/build-studies.test.js`:

```js
import { parsePgnGames, extractChapterName, extractMainLine, extractMoveAnnotations } from './build-studies.js'

// ... existing tests ...

describe('extractMoveAnnotations', () => {
  it('returns empty array for empty string', () => {
    expect(extractMoveAnnotations('')).toEqual([])
  })

  it('returns null annotation for moves with no comments', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 *'
    const result = extractMoveAnnotations(pgn)
    expect(result).toHaveLength(2)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
  })

  it('attaches text comment to the correct move', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 { Good move } 2. Bf4 *'
    const result = extractMoveAnnotations(pgn)
    // move 0: d4, move 1: Nf6, move 2: Bf4
    expect(result[1]).toMatchObject({ text: 'Good move', arrows: [], squares: [] })
    expect(result[0]).toBeNull()
    expect(result[2]).toBeNull()
  })

  it('merges consecutive comment blocks for the same move', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 { The text } { [%cal Rd4d5] } 2. Bf4 *'
    const result = extractMoveAnnotations(pgn)
    expect(result[1]).toMatchObject({
      text: 'The text',
      arrows: [{ from: 'd4', to: 'd5', color: 'red' }],
      squares: [],
    })
  })

  it('parses [%cal] arrows with color codes', () => {
    const pgn = '[Event "Test"]\n\n1. d4 { [%cal Ra1a8,Gb1b8,Yc1c8,Bd1d8] } *'
    const result = extractMoveAnnotations(pgn)
    expect(result[0]).toMatchObject({
      text: null,
      arrows: [
        { from: 'a1', to: 'a8', color: 'red' },
        { from: 'b1', to: 'b8', color: 'green' },
        { from: 'c1', to: 'c8', color: 'yellow' },
        { from: 'd1', to: 'd8', color: 'blue' },
      ],
      squares: [],
    })
  })

  it('parses [%csl] squares with color codes', () => {
    const pgn = '[Event "Test"]\n\n1. d4 { [%csl Gd4,Re4] } *'
    const result = extractMoveAnnotations(pgn)
    expect(result[0]).toMatchObject({
      text: null,
      arrows: [],
      squares: [
        { square: 'd4', color: 'green' },
        { square: 'e4', color: 'red' },
      ],
    })
  })

  it('strips variations before counting moves', () => {
    const pgn = '[Event "Test"]\n\n1. d4 d5 (1... Nf6 2. c4) { After d5 } 2. c4 *'
    const result = extractMoveAnnotations(pgn)
    // main line: d4 (0), d5 (1), c4 (2)
    expect(result[1]).toMatchObject({ text: 'After d5' })
    expect(result[2]).toBeNull()
  })

  it('returns null for a move with no text and no arrows/squares', () => {
    // comment block contains only [%csl] with invalid format
    const pgn = '[Event "Test"]\n\n1. d4 { } *'
    const result = extractMoveAnnotations(pgn)
    expect(result[0]).toBeNull()
  })
})

describe('extractMainLine with annotations', () => {
  it('includes annotation field on each position', () => {
    const pgn = '[Event "Test"]\n\n1. d4 { White starts } Nf6 *'
    const positions = extractMainLine(pgn)
    expect(positions[0]).toHaveProperty('annotation')
    expect(positions[0].annotation).toMatchObject({ text: 'White starts' })
    expect(positions[1].annotation).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run scripts/build-studies.test.js
```

Expected: FAIL — `extractMoveAnnotations is not a function` (not exported yet)

- [ ] **Step 3: Implement helper functions and `extractMoveAnnotations` in `build-studies.js`**

Add before the `buildStudies` function:

```js
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
  const body = pgnText.replace(/\[[^\]]*\]\s*/g, '').trim()
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
```

- [ ] **Step 4: Update `extractMainLine` to include `annotation` per position**

Replace the existing `extractMainLine` function:

```js
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
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run scripts/build-studies.test.js
```

Expected: all tests pass

- [ ] **Step 6: Rebuild `studies.json`**

```bash
node scripts/build-studies.js
```

Expected output: `Wrote 14 chapters to .../public/studies.json`

Spot-check that annotation appears:
```bash
node -e "const d = JSON.parse(require('fs').readFileSync('public/studies.json','utf8')); const pos = d.chapters[0].lines[0].positions; console.log(JSON.stringify(pos.find(p => p.annotation), null, 2))"
```

Expected: a position object with a non-null `annotation` field containing `text`, `arrows`, and `squares`.

- [ ] **Step 7: Rebuild `studies-with-eval.json`**

`fetch-evals.js` reads `studies.json` (now with `annotation`) and writes to `studies-with-eval.json`. It uses the FEN cache from the existing `studies-with-eval.json`, so no new API calls are needed.

```bash
node scripts/fetch-evals.js
```

Expected: `Loaded N cached FEN evaluations` followed by skipped (cached) entries — no API calls. Verify annotation is in output:

```bash
node -e "const d = JSON.parse(require('fs').readFileSync('public/studies-with-eval.json','utf8')); const pos = d.chapters[0].lines[0].positions; console.log(JSON.stringify(pos.find(p => p.annotation), null, 2))"
```

Expected: same annotation object, now also with `cp` value.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-studies.js scripts/build-studies.test.js public/studies.json public/studies-with-eval.json
git commit -m "feat: extract PGN annotations per move in build pipeline"
```

---

## Task 2: useDrill exposes `currentAnnotation`

**Files:**
- Modify: `src/useDrill.js`
- Modify: `src/useDrill.test.js`

- [ ] **Step 1: Write failing tests for `currentAnnotation`**

Add to `src/useDrill.test.js`. First, add an annotated chapter fixture at the top of the file (alongside the existing fixtures):

```js
const annotatedLine = {
  id: 'annotated-0',
  pgn: '1. d4 d5',
  positions: [
    { fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', move: 'd4', cp: 15, annotation: { text: 'Start with d4', arrows: [], squares: [] } },
    { fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', move: 'd5', cp: 5, annotation: null },
  ],
}
const annotatedChapter = { id: 'annotated', name: 'Annotated', lines: [annotatedLine] }
```

Then add tests:

```js
describe('currentAnnotation', () => {
  it('returns annotation for the next move to play', () => {
    const { result } = renderHook(() =>
      useDrill(annotatedChapter, () => 0, vi.fn())
    )
    // At move 0, user must play d4. annotation is on positions[0]
    expect(result.current.currentAnnotation).toMatchObject({ text: 'Start with d4' })
  })

  it('returns null after playing the annotated move (moveIndex advances to an un-annotated slot)', () => {
    const { result } = renderHook(() =>
      useDrill(annotatedChapter, () => 0, vi.fn())
    )
    act(() => {
      result.current.handleUserMove('d2', 'd4')
    })
    // After d4, black auto-plays d5 (line completes). moveIndex = 1, allAnnotations[1] = null
    expect(result.current.currentAnnotation).toBeNull()
  })

  it('returns null when chapter has no annotation data', () => {
    const noAnnotationLine = {
      id: 'plain-0',
      pgn: '1. d4 d5',
      positions: [
        { fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', move: 'd4', cp: 15, annotation: null },
        { fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', move: 'd5', cp: 5, annotation: null },
      ],
    }
    const plainChapter = { id: 'plain', name: 'Plain', lines: [noAnnotationLine] }
    const { result } = renderHook(() =>
      useDrill(plainChapter, () => 0, vi.fn())
    )
    expect(result.current.currentAnnotation).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/useDrill.test.js
```

Expected: FAIL — `currentAnnotation is not a function` or `undefined`

- [ ] **Step 3: Update `initLine` to extract `allAnnotations`**

In `src/useDrill.js`, inside `initLine`, add after the `allCps` line:

```js
const allAnnotations = line.positions.map(p => p.annotation ?? null)
```

And include it in the return object:

```js
return { chess, moves, cps, allAnnotations, moveIndex, lineId, lineIndex, lineLength }
```

- [ ] **Step 4: Expose `currentAnnotation` in the `useDrill` return**

At the bottom of `useDrill`, just before the `return` statement, add:

```js
const currentAnnotation = stateRef.current.allAnnotations[stateRef.current.moveIndex] ?? null
```

Then add `currentAnnotation` to the returned object:

```js
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
  newlyUnlockedDepth,
  currentAnnotation,
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run src/useDrill.test.js
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/useDrill.js src/useDrill.test.js
git commit -m "feat: expose currentAnnotation in useDrill"
```

---

## Task 3: `useProgress` — add `showAnnotations` setting

**Files:**
- Modify: `src/useProgress.js`
- Modify: `src/useProgress.test.js`

- [ ] **Step 1: Write failing tests**

Add to `src/useProgress.test.js`:

```js
describe('showAnnotations setting', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults showAnnotations to true', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.chunkSettings.showAnnotations).toBe(true)
  })

  it('persists showAnnotations to localStorage via setChunkSettings', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setChunkSettings({ ...result.current.chunkSettings, showAnnotations: false })
    })
    expect(result.current.chunkSettings.showAnnotations).toBe(false)
    const stored = JSON.parse(localStorage.getItem('chess-practice:chunk-settings'))
    expect(stored.showAnnotations).toBe(false)
  })

  it('loads showAnnotations from localStorage', () => {
    localStorage.setItem('chess-practice:chunk-settings', JSON.stringify({ startDepth: 4, unlockN: 3, showAnnotations: false }))
    const { result } = renderHook(() => useProgress())
    expect(result.current.chunkSettings.showAnnotations).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/useProgress.test.js
```

Expected: FAIL — `showAnnotations` not present in defaults

- [ ] **Step 3: Update `useProgress.js`**

Change `DEFAULT_CHUNK_SETTINGS`:

```js
const DEFAULT_CHUNK_SETTINGS = { startDepth: 4, unlockN: 3, showAnnotations: true }
```

No other changes needed — `chunkSettings` is already the full object and `setChunkSettings` already persists it wholesale. However, `setChunkSettings` currently only accepts `{ startDepth, unlockN }`. Update it to accept the full settings object:

```js
const setChunkSettings = useCallback((next) => {
  setChunkSettingsState(next)
  localStorage.setItem(CHUNK_SETTINGS_KEY, JSON.stringify(next))
}, [])
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/useProgress.test.js
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/useProgress.js src/useProgress.test.js
git commit -m "feat: add showAnnotations to chunk settings in useProgress"
```

---

## Task 4: App.jsx — wire `currentAnnotation` state

**Files:**
- Modify: `src/App.jsx`

No new tests (App is a thin orchestrator).

- [ ] **Step 1: Add `currentAnnotation` state and pass new props**

Inside `App`, add state after the `useProgress` destructuring:

```js
const [currentAnnotation, setCurrentAnnotation] = useState(null)
```

Also derive `showAnnotations` from `chunkSettings`:

```js
const showAnnotations = chunkSettings.showAnnotations
```

Pass new props to `<Sidebar>`:

```jsx
<Sidebar
  chapters={chapters}
  getMasteredCount={getMasteredCount}
  activeChapterId={activeChapterId}
  onSelect={setActiveChapterId}
  getUnlockedDepth={getUnlockedDepth}
  chunkSettings={chunkSettings}
  setChunkSettings={setChunkSettings}
  currentAnnotation={currentAnnotation}
/>
```

Pass new props to `<PracticeBoard>`:

```jsx
<PracticeBoard
  key={activeChapterId}
  chapter={activeChapter}
  getScore={getScore}
  setScore={setScore}
  unlockedDepth={unlockedDepth}
  recordCorrectAtDepth={recordCorrectAtDepth}
  onAnnotationChange={setCurrentAnnotation}
  showAnnotations={showAnnotations}
/>
```

- [ ] **Step 2: Reset `currentAnnotation` when chapter changes**

Since `PracticeBoard` remounts on `key={activeChapterId}` change, the `onAnnotationChange` callback fires on mount with the first annotation — no extra effect needed. But to avoid stale annotation showing during the remount, add a `useEffect` in App:

```js
useEffect(() => {
  setCurrentAnnotation(null)
}, [activeChapterId])
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: thread currentAnnotation and showAnnotations through App"
```

---

## Task 5: PracticeBoard — `onAnnotationChange` callback + board annotations

**Files:**
- Modify: `src/PracticeBoard.jsx`

- [ ] **Step 1: Accept new props and fire `onAnnotationChange`**

Update the function signature:

```js
export function PracticeBoard({ chapter, getScore, setScore, unlockedDepth, recordCorrectAtDepth, onAnnotationChange, showAnnotations }) {
```

Add a `useEffect` after the `useDrill` destructuring block:

```js
useEffect(() => {
  onAnnotationChange?.(currentAnnotation)
}, [currentAnnotation, onAnnotationChange])
```

- [ ] **Step 2: Derive arrow and square styles from `currentAnnotation`**

Add a color map constant near the top of the component (before the `return`):

```js
const ANNOTATION_COLOR_MAP = {
  red: 'rgba(255, 0, 0, 0.4)',
  green: 'rgba(0, 128, 0, 0.4)',
  yellow: 'rgba(255, 255, 0, 0.4)',
  blue: 'rgba(0, 0, 255, 0.4)',
}
```

Replace the existing `squareStyles` definition with a version that merges annotation squares:

```js
const annotationSquareStyles = showAnnotations && currentAnnotation?.squares?.length
  ? Object.fromEntries(
      currentAnnotation.squares.map(({ square, color }) => [
        square,
        { backgroundColor: ANNOTATION_COLOR_MAP[color] ?? 'rgba(0,0,0,0.3)' },
      ])
    )
  : {}

const squareStyles = {
  ...annotationSquareStyles,
  ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(255,255,0,0.4)' } } : {}),
}
```

Add the `customArrows` derivation:

```js
const customArrows = showAnnotations && currentAnnotation?.arrows?.length
  ? currentAnnotation.arrows.map(({ from, to, color }) => ({ startSquare: from, endSquare: to, color }))
  : []
```

- [ ] **Step 3: Pass arrows to Chessboard options**

Update the `<Chessboard>` options to include `arrows`:

```jsx
<Chessboard
  options={{
    position: fen,
    allowDragging: isUserTurn && !lockedRef.current,
    onPieceDrop,
    onSquareClick,
    squareStyles,
    arrows: customArrows,
    boardStyle: { width: '480px', height: '480px' },
  }}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/PracticeBoard.jsx
git commit -m "feat: PracticeBoard fires onAnnotationChange and renders annotation arrows/squares"
```

---

## Task 6: Sidebar — annotation text panel + toggle + CSS

**Files:**
- Modify: `src/Sidebar.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add `currentAnnotation` prop and annotation text panel to Sidebar**

Update `Sidebar`'s function signature:

```js
export function Sidebar({ chapters, getMasteredCount, activeChapterId, onSelect, getUnlockedDepth, chunkSettings, setChunkSettings, currentAnnotation }) {
```

Add the annotation panel above the `chunk-settings` div (inside the `<aside>` but below the chapter list):

```jsx
{chunkSettings.showAnnotations && currentAnnotation?.text && (
  <div className="annotation-text">
    <div className="annotation-text-label">Annotation</div>
    <p className="annotation-text-body">{currentAnnotation.text}</p>
  </div>
)}
```

- [ ] **Step 2: Add `showAnnotations` toggle to the settings panel**

Inside the `{settingsOpen && ...}` block, add after the existing two `<label>` elements:

```jsx
<label className="chunk-settings-label chunk-settings-label--toggle">
  Show annotations
  <input
    type="checkbox"
    checked={chunkSettings.showAnnotations}
    onChange={e => setChunkSettings({ ...chunkSettings, showAnnotations: e.target.checked })}
  />
</label>
```

- [ ] **Step 3: Add CSS for annotation panel and toggle label**

Add to `src/index.css`, in the chunk-settings section (after the existing chunk-settings rules):

```css
.annotation-text {
  margin: 0.75rem 0.5rem 0;
  padding: 0.75rem;
  background: #1e2d3d;
  border-left: 3px solid #4a9eda;
  border-radius: 0 4px 4px 0;
}

.annotation-text-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b8fa8;
  margin-bottom: 0.4rem;
}

.annotation-text-body {
  font-size: 0.85rem;
  color: #c8d8e8;
  margin: 0;
  line-height: 1.5;
}

.chunk-settings-label--toggle {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.chunk-settings-label--toggle input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: #4a9eda;
  cursor: pointer;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all 50+ tests pass

- [ ] **Step 5: Commit**

```bash
git add src/Sidebar.jsx src/index.css
git commit -m "feat: show PGN annotation text in Sidebar with show/hide toggle"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open in browser and verify**

Navigate to the app. Select the "Black Plays Benko" chapter. Verify:

1. Before playing the first move, the Sidebar shows no annotation (d4 has no comment in the PGN).
2. After playing d4, arrows and highlighted squares for the next move (Nf6 — no annotation either) — nothing shown.
3. Continue until you reach move `c5` (white's Bf4, black's c5). The c5 position has annotation `{ The Benoni Systems } { [%cal Rc7c5] }`. Verify the Sidebar shows "The Benoni Systems" and the board shows a red arrow from c7 to c5.
4. Next move `d5` has `{ White's best choice } { [%csl Gd5] }`. Verify the text and a green square on d5.
5. Open Chunk settings in the Sidebar → toggle "Show annotations" off → board arrows and text both disappear → toggle back on → they reappear.
6. Reload the page → `showAnnotations` setting is persisted.

- [ ] **Step 3: Final commit (if any tweaks were made)**

```bash
git add -p
git commit -m "fix: annotation display tweaks after manual verification"
```
