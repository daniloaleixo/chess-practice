# Chunked Progressive Drilling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-chapter progressive move-unlocking so users drill in expanding chunks, with configurable unlock thresholds and a toggle to start from the current chunk boundary.

**Architecture:** `useProgress` gains chunk state in two new localStorage keys. `useDrill` accepts `unlockedDepth`, `startFromChunk`, and `recordCorrectAtDepth` to truncate lines and fast-forward positions. `App` computes and threads these props through `PracticeBoard`. `Sidebar` shows unlock progress and global settings inputs.

**Tech Stack:** React 18, chess.js, Vite, Vitest + @testing-library/react

---

## File Map

| File | Change |
|------|--------|
| `src/useProgress.js` | Add chunk settings + progress state; 3 new exported functions |
| `src/useProgress.test.js` | Add 9 new chunk-state tests |
| `src/useDrill.js` | Accept chunk opts, truncate lines, fast-forward position, expose `newlyUnlockedDepth` |
| `src/useDrill.test.js` | Add 5 new chunk-behavior tests |
| `src/App.jsx` | Extract new props from useProgress, compute `unlockedDepth`, pass to Sidebar + PracticeBoard |
| `src/PracticeBoard.jsx` | Accept chunk props, add toggle + unlock toast, restart on toggle change |
| `src/Sidebar.jsx` | Render unlock indicator per chapter + collapsible settings panel |
| `src/index.css` | Add styles for chunk toggle, unlock toast, settings panel |

---

## Task 1: Extend useProgress with chunk state

**Files:**
- Modify: `src/useProgress.js`
- Modify: `src/useProgress.test.js`

- [ ] **Step 1: Add failing tests to `src/useProgress.test.js`**

Append after the closing `})` of the existing `describe('useProgress', ...)` block:

```js
describe('chunk state', () => {
  it('chunkSettings defaults to startDepth 4 and unlockN 3', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.chunkSettings).toEqual({ startDepth: 4, unlockN: 3 })
  })

  it('setChunkSettings updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setChunkSettings({ startDepth: 6, unlockN: 5 }))
    expect(result.current.chunkSettings).toEqual({ startDepth: 6, unlockN: 5 })
    expect(JSON.parse(localStorage.getItem('chess-practice:chunk-settings'))).toEqual({ startDepth: 6, unlockN: 5 })
  })

  it('getUnlockedDepth returns startDepth for a new chapter', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getUnlockedDepth('benko', 11)).toBe(4)
  })

  it('getUnlockedDepth caps at lineLength', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getUnlockedDepth('benko', 3)).toBe(3)
  })

  it('recordCorrectAtDepth increments correctAtDepth without unlocking before N', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    expect(result.current.getUnlockedDepth('benko', 11)).toBe(4)
  })

  it('recordCorrectAtDepth unlocks next depth after unlockN correct answers', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    expect(result.current.getUnlockedDepth('benko', 11)).toBe(5)
  })

  it('recordCorrectAtDepth returns true when an unlock happens', () => {
    const { result } = renderHook(() => useProgress())
    let unlocked
    act(() => { result.current.recordCorrectAtDepth('benko', 11) })
    act(() => { result.current.recordCorrectAtDepth('benko', 11) })
    act(() => { unlocked = result.current.recordCorrectAtDepth('benko', 11) })
    expect(unlocked).toBe(true)
  })

  it('recordCorrectAtDepth returns false when not yet unlocking', () => {
    const { result } = renderHook(() => useProgress())
    let unlocked
    act(() => { unlocked = result.current.recordCorrectAtDepth('benko', 11) })
    expect(unlocked).toBe(false)
  })

  it('recordCorrectAtDepth does not unlock past lineLength', () => {
    const { result } = renderHook(() => useProgress())
    // lineLength=4 equals startDepth=4 — already at cap, should never unlock
    act(() => { result.current.recordCorrectAtDepth('benko', 4) })
    act(() => { result.current.recordCorrectAtDepth('benko', 4) })
    act(() => { result.current.recordCorrectAtDepth('benko', 4) })
    expect(result.current.getUnlockedDepth('benko', 4)).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/danilo/Documents/danilo/chess-practice && npx vitest run src/useProgress.test.js
```

Expected: 9 new tests fail, existing tests still pass.

- [ ] **Step 3: Replace `src/useProgress.js` with the new implementation**

```js
import { useState, useCallback, useRef } from 'react'

const STORAGE_KEY = 'chess-practice:progress'
const CHUNK_SETTINGS_KEY = 'chess-practice:chunk-settings'
const CHUNK_PROGRESS_KEY = 'chess-practice:chunk-progress'

const DEFAULT_CHUNK_SETTINGS = { startDepth: 4, unlockN: 3 }

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function loadChunkSettings() {
  try { return JSON.parse(localStorage.getItem(CHUNK_SETTINGS_KEY)) ?? DEFAULT_CHUNK_SETTINGS } catch { return DEFAULT_CHUNK_SETTINGS }
}

function loadChunkProgress() {
  try { return JSON.parse(localStorage.getItem(CHUNK_PROGRESS_KEY) ?? '{}') } catch { return {} }
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress)
  const [chunkSettings, setChunkSettingsState] = useState(loadChunkSettings)
  const [chunkProgress, setChunkProgressState] = useState(loadChunkProgress)

  const chunkSettingsRef = useRef(chunkSettings)
  chunkSettingsRef.current = chunkSettings
  const chunkProgressRef = useRef(chunkProgress)
  chunkProgressRef.current = chunkProgress

  const getScore = useCallback((lineId) => progress[lineId] ?? 0, [progress])

  const setScore = useCallback((lineId, scoreOrUpdater) => {
    setProgress(prev => {
      const current = prev[lineId] ?? 0
      const newScore = typeof scoreOrUpdater === 'function' ? scoreOrUpdater(current) : scoreOrUpdater
      const next = { ...prev, [lineId]: newScore }
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

  const getUnlockedDepth = useCallback((chapterId, lineLength) => {
    const { startDepth } = chunkSettingsRef.current
    const p = chunkProgressRef.current[chapterId]
    const depth = p ? p.unlockedDepth : startDepth
    return Math.min(depth, lineLength)
  }, [])

  const recordCorrectAtDepth = useCallback((chapterId, lineLength) => {
    const { startDepth, unlockN } = chunkSettingsRef.current
    const prev = chunkProgressRef.current
    const current = prev[chapterId] ?? { unlockedDepth: startDepth, correctAtDepth: 0 }
    const newCorrect = current.correctAtDepth + 1

    let next, didUnlock
    if (newCorrect >= unlockN && current.unlockedDepth < lineLength) {
      didUnlock = true
      next = { ...prev, [chapterId]: { unlockedDepth: current.unlockedDepth + 1, correctAtDepth: 0 } }
    } else {
      didUnlock = false
      next = { ...prev, [chapterId]: { ...current, correctAtDepth: newCorrect } }
    }

    chunkProgressRef.current = next
    localStorage.setItem(CHUNK_PROGRESS_KEY, JSON.stringify(next))
    setChunkProgressState(next)
    return didUnlock
  }, [])

  const setChunkSettings = useCallback(({ startDepth, unlockN }) => {
    const next = { startDepth, unlockN }
    setChunkSettingsState(next)
    localStorage.setItem(CHUNK_SETTINGS_KEY, JSON.stringify(next))
  }, [])

  return { getScore, setScore, getMasteredCount, resetChapter, chunkSettings, getUnlockedDepth, recordCorrectAtDepth, setChunkSettings }
}
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
cd /home/danilo/Documents/danilo/chess-practice && npx vitest run
```

Expected: all existing + 9 new tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/danilo/Documents/danilo/chess-practice && git add src/useProgress.js src/useProgress.test.js && git commit -m "feat: add chunk progress state to useProgress"
```

---

## Task 2: Extend useDrill with chunk-aware drilling

**Files:**
- Modify: `src/useDrill.js`
- Modify: `src/useDrill.test.js`

- [ ] **Step 1: Add failing tests to `src/useDrill.test.js`**

Append after the last existing test block:

```js
describe('chunk-aware drilling', () => {
  const mockChapter = {
    id: 'test-chapter',
    lines: [{
      id: 'test-chapter-0',
      positions: [
        { move: 'd4', cp: 30 },
        { move: 'Nf6', cp: 20 },
        { move: 'Bf4', cp: 35 },
        { move: 'c5', cp: 25 },
        { move: 'd5', cp: 40 },
        { move: 'b5', cp: 30 },
      ]
    }]
  }
  const getScore = () => 0
  const setScore = vi.fn()
  const recordFn = vi.fn()

  beforeEach(() => { setScore.mockClear(); recordFn.mockClear() })

  it('truncates the line to unlockedDepth', () => {
    const { result } = renderHook(() =>
      useDrill(mockChapter, getScore, setScore, { unlockedDepth: 4, startFromChunk: false, recordCorrectAtDepth: recordFn })
    )
    // d4 → Nf6 auto → Bf4 → c5 auto → chunk complete (isUserTurn false)
    act(() => { result.current.handleUserMove('d2', 'd4') })
    act(() => { result.current.handleUserMove('c1', 'f4') })
    expect(result.current.isUserTurn).toBe(false)
  })

  it('startFromChunk fast-forwards to the last White move in the chunk', () => {
    const { result } = renderHook(() =>
      useDrill(mockChapter, getScore, setScore, { unlockedDepth: 4, startFromChunk: true, recordCorrectAtDepth: recordFn })
    )
    // depth=4: moves=[d4,Nf6,Bf4,c5], lastWhiteIdx=2
    // d4 and Nf6 are pre-applied; user starts at Bf4
    expect(result.current.moveHistory.length).toBe(2)
  })

  it('recordCorrectAtDepth is called with chapterId and full lineLength on chunk completion', () => {
    const { result } = renderHook(() =>
      useDrill(mockChapter, getScore, setScore, { unlockedDepth: 4, startFromChunk: false, recordCorrectAtDepth: recordFn })
    )
    act(() => { result.current.handleUserMove('d2', 'd4') })
    act(() => { result.current.handleUserMove('c1', 'f4') })
    expect(recordFn).toHaveBeenCalledWith('test-chapter', 6)
  })

  it('newlyUnlockedDepth is null initially', () => {
    const { result } = renderHook(() =>
      useDrill(mockChapter, getScore, setScore, { unlockedDepth: 4, startFromChunk: false, recordCorrectAtDepth: recordFn })
    )
    expect(result.current.newlyUnlockedDepth).toBeNull()
  })

  it('newlyUnlockedDepth is set to new depth when recordCorrectAtDepth returns true', () => {
    recordFn.mockReturnValue(true)
    const { result } = renderHook(() =>
      useDrill(mockChapter, getScore, setScore, { unlockedDepth: 4, startFromChunk: false, recordCorrectAtDepth: recordFn })
    )
    act(() => { result.current.handleUserMove('d2', 'd4') })
    act(() => { result.current.handleUserMove('c1', 'f4') })
    expect(result.current.newlyUnlockedDepth).toBe(5)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/danilo/Documents/danilo/chess-practice && npx vitest run src/useDrill.test.js
```

Expected: 5 new tests fail, existing tests still pass.

- [ ] **Step 3: Replace `src/useDrill.js` with the chunk-aware implementation**

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

function initLine(chapter, getScore, lineIndex = null, effectiveDepth = Infinity, startFromChunk = false) {
  const idx = lineIndex ?? pickWeightedRandom(chapter.lines, getScore)
  const line = chapter.lines[idx]
  const allMoves = line.positions.map(p => p.move.replace('0-0-0', 'O-O-O').replace('0-0', 'O-O'))
  const allCps = line.positions.map(p => p.cp ?? 0)
  const cap = Math.min(effectiveDepth, allMoves.length)
  const moves = allMoves.slice(0, cap)
  const cps = allCps.slice(0, cap)

  const chess = new Chess()
  let moveIndex = 0

  if (startFromChunk && cap > 0) {
    const lastWhiteIdx = [...Array(cap).keys()].filter(i => i % 2 === 0).at(-1) ?? 0
    for (let i = 0; i < lastWhiteIdx; i++) chess.move(moves[i])
    moveIndex = lastWhiteIdx
  }

  return { chess, moves, cps, moveIndex, lineId: line.id, lineIndex: idx, lineLength: line.positions.length }
}

export function useDrill(chapter, getScore, setScore, { unlockedDepth = Infinity, startFromChunk = false, recordCorrectAtDepth = null } = {}) {
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = initLine(chapter, getScore, null, unlockedDepth, startFromChunk)
  }

  const [fen, setFen] = useState(() => stateRef.current.chess.fen())
  const [moveHistory, setMoveHistory] = useState(() => [...stateRef.current.chess.history()])
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [currentCp, setCurrentCp] = useState(0)
  const [lineIndex, setLineIndex] = useState(() => stateRef.current.lineIndex)
  const [newlyUnlockedDepth, setNewlyUnlockedDepth] = useState(null)

  const hintUsedRef = useRef(false)
  const startNewLineRef = useRef(null)
  const recordCorrectAtDepthRef = useRef(recordCorrectAtDepth)
  recordCorrectAtDepthRef.current = recordCorrectAtDepth
  const unlockedDepthRef = useRef(unlockedDepth)
  unlockedDepthRef.current = unlockedDepth
  const startFromChunkRef = useRef(startFromChunk)
  startFromChunkRef.current = startFromChunk

  const startNewLine = useCallback(() => {
    const next = initLine(chapter, getScore, null, unlockedDepthRef.current, startFromChunkRef.current)
    stateRef.current = next
    hintUsedRef.current = false
    setNewlyUnlockedDepth(null)
    setFen(next.chess.fen())
    setMoveHistory([...next.chess.history()])
    setCurrentCp(0)
    setLineIndex(next.lineIndex)
    setIsUserTurn(true)
  }, [chapter, getScore])
  startNewLineRef.current = startNewLine

  const restartCurrentLine = useCallback(() => {
    const { lineIndex: idx } = stateRef.current
    const next = initLine(chapter, getScore, idx, unlockedDepthRef.current, startFromChunkRef.current)
    stateRef.current = next
    hintUsedRef.current = false
    setNewlyUnlockedDepth(null)
    setFen(next.chess.fen())
    setMoveHistory([...next.chess.history()])
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
        setScore(stateRef.current.lineId, s => s + 1)
        const didUnlock = recordCorrectAtDepthRef.current?.(chapter.id, stateRef.current.lineLength) ?? false
        if (didUnlock) setNewlyUnlockedDepth(unlockedDepthRef.current + 1)
      }
      setIsUserTurn(false)
      setTimeout(() => startNewLineRef.current(), 2000)
    } else {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      stateRef.current.moveIndex = idx
      setIsUserTurn(true)
    }
  }, [setScore, chapter.id])

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
    newlyUnlockedDepth,
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
cd /home/danilo/Documents/danilo/chess-practice && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/danilo/Documents/danilo/chess-practice && git add src/useDrill.js src/useDrill.test.js && git commit -m "feat: chunk-aware line truncation and fast-forward in useDrill"
```

---

## Task 3: Wire chunk props through App and PracticeBoard

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/PracticeBoard.jsx`

- [ ] **Step 1: Replace `src/App.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { PracticeBoard } from './PracticeBoard'
import { Sidebar } from './Sidebar'
import { useProgress } from './useProgress'

export default function App() {
  const [chapters, setChapters] = useState(null)
  const [activeChapterId, setActiveChapterId] = useState(null)
  const [error, setError] = useState(null)
  const {
    getMasteredCount, getScore, setScore,
    chunkSettings, getUnlockedDepth, recordCorrectAtDepth, setChunkSettings,
  } = useProgress()

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
  const maxLineLength = activeChapter.lines.reduce((max, l) => Math.max(max, l.positions.length), 0)
  const unlockedDepth = getUnlockedDepth(activeChapter.id, maxLineLength)

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
          getUnlockedDepth={getUnlockedDepth}
          chunkSettings={chunkSettings}
          setChunkSettings={setChunkSettings}
        />
        <main className="app-main">
          <PracticeBoard
            key={activeChapterId}
            chapter={activeChapter}
            getScore={getScore}
            setScore={setScore}
            unlockedDepth={unlockedDepth}
            recordCorrectAtDepth={recordCorrectAtDepth}
          />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/PracticeBoard.jsx` — add chunk props and toggle state**

Change line 7 (function signature) from:
```jsx
export function PracticeBoard({ chapter, getScore, setScore }) {
```
to:
```jsx
export function PracticeBoard({ chapter, getScore, setScore, unlockedDepth, recordCorrectAtDepth }) {
```

Add `useState` import is already present. Add `useEffect` to the import line:
```jsx
import { useState, useCallback, useRef, useEffect } from 'react'
```

After the existing `const lockedRef` and `feedbackTimerRef` lines, add:
```jsx
const [startFromChunk, setStartFromChunk] = useState(false)
const isFirstRender = useRef(true)
```

Change the `useDrill` call (line 8–19) to:
```jsx
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
  newlyUnlockedDepth,
} = useDrill(chapter, getScore, setScore, { unlockedDepth, startFromChunk, recordCorrectAtDepth })
```

Add the effect to restart when the toggle changes, after the `const feedbackTimerRef` line:
```jsx
useEffect(() => {
  if (isFirstRender.current) { isFirstRender.current = false; return }
  restartCurrentLine()
}, [startFromChunk, restartCurrentLine])
```

- [ ] **Step 3: Run all tests**

```bash
cd /home/danilo/Documents/danilo/chess-practice && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/danilo/Documents/danilo/chess-practice && git add src/App.jsx src/PracticeBoard.jsx && git commit -m "feat: wire chunk props through App and PracticeBoard"
```

---

## Task 4: PracticeBoard UI — chunk toggle and unlock toast

**Files:**
- Modify: `src/PracticeBoard.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add toggle and unlock toast to `src/PracticeBoard.jsx` JSX**

In the JSX returned by `PracticeBoard`, add the toggle button inside the `practice-header` div, after the existing `practice-line-counter` span:

```jsx
<div className="practice-header">
  <span className="practice-chapter-name">{chapter.name}</span>
  <span className="practice-line-counter">Line {currentLineIndex + 1} of {totalLines}</span>
  <button
    className={`chunk-toggle${startFromChunk ? ' chunk-toggle--active' : ''}`}
    onClick={() => setStartFromChunk(v => !v)}
  >
    {startFromChunk ? 'From chunk' : 'Full line'}
  </button>
</div>
```

Add the unlock toast after the last `{isUserTurn && feedback && ...}` block, before the closing `</div>`:

```jsx
{newlyUnlockedDepth !== null && (
  <div className="feedback feedback--correct">Move {newlyUnlockedDepth} unlocked!</div>
)}
```

- [ ] **Step 2: Add CSS for chunk toggle to `src/index.css`**

Append to the end of `src/index.css`:

```css
.chunk-toggle {
  padding: 4px 10px;
  border: 1px solid #555;
  border-radius: 4px;
  background: #2a2a2a;
  color: #ccc;
  cursor: pointer;
  font-size: 0.75rem;
}

.chunk-toggle--active {
  background: #3a5a3a;
  border-color: #6a9a6a;
  color: #aaffaa;
}
```

- [ ] **Step 3: Verify in browser**

```bash
cd /home/danilo/Documents/danilo/chess-practice && npx vite --port 5173
```

Open http://localhost:5173. Confirm:
- "Full line" toggle button appears in the board header.
- Clicking it switches label to "From chunk" and restarts the drill from the last White move of the current chunk.
- After completing the chunk N times, a "Move X unlocked!" message briefly appears.

- [ ] **Step 4: Commit**

```bash
cd /home/danilo/Documents/danilo/chess-practice && git add src/PracticeBoard.jsx src/index.css && git commit -m "feat: add chunk toggle and unlock toast to PracticeBoard"
```

---

## Task 5: Sidebar UI — unlock indicator and settings panel

**Files:**
- Modify: `src/Sidebar.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Replace `src/Sidebar.jsx`**

```jsx
import { useState } from 'react'

export function Sidebar({ chapters, getMasteredCount, activeChapterId, onSelect, getUnlockedDepth, chunkSettings, setChunkSettings }) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <aside className="sidebar">
      <div className="sidebar-title">CHAPTERS</div>
      {chapters.map(chapter => {
        const mastered = getMasteredCount(chapter)
        const total = chapter.lines.length
        const pct = total > 0 ? (mastered / total) * 100 : 0
        const isActive = chapter.id === activeChapterId
        const maxLen = chapter.lines.reduce((max, l) => Math.max(max, l.positions.length), 0)
        const unlocked = getUnlockedDepth(chapter.id, maxLen)
        const isFullyUnlocked = unlocked >= maxLen

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
            {!isFullyUnlocked && (
              <div className="sidebar-chunk-depth">move {unlocked} / {maxLen} unlocked</div>
            )}
          </div>
        )
      })}

      <div className="chunk-settings">
        <button
          className="chunk-settings-toggle"
          onClick={e => { e.stopPropagation(); setSettingsOpen(v => !v) }}
        >
          {settingsOpen ? '▲' : '▼'} Chunk settings
        </button>
        {settingsOpen && (
          <div className="chunk-settings-panel">
            <label className="chunk-settings-label">
              Start at move
              <input
                type="number"
                min="1"
                className="chunk-settings-input"
                value={chunkSettings.startDepth}
                onChange={e => setChunkSettings({ ...chunkSettings, startDepth: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="chunk-settings-label">
              Unlock after N correct
              <input
                type="number"
                min="1"
                className="chunk-settings-input"
                value={chunkSettings.unlockN}
                onChange={e => setChunkSettings({ ...chunkSettings, unlockN: Math.max(1, Number(e.target.value)) })}
              />
            </label>
          </div>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Add CSS for sidebar chunk UI to `src/index.css`**

Append to `src/index.css`:

```css
.sidebar-chunk-depth {
  font-size: 0.7rem;
  color: #888;
  margin-top: 2px;
}

.chunk-settings {
  margin-top: 16px;
  border-top: 1px solid #333;
  padding-top: 10px;
}

.chunk-settings-toggle {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
  width: 100%;
  text-align: left;
}

.chunk-settings-toggle:hover {
  color: #ccc;
}

.chunk-settings-panel {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chunk-settings-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #aaa;
}

.chunk-settings-input {
  width: 54px;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ddd;
  padding: 2px 6px;
  font-size: 0.75rem;
  text-align: center;
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:5173. Confirm:
- Each chapter shows "move N / M unlocked" when not fully unlocked; the label disappears once N >= M.
- "▼ Chunk settings" expands a panel with two number inputs.
- Changing "Start at move" updates `chunkSettings.startDepth`; changing "Unlock after N correct" updates `chunkSettings.unlockN`.
- Changes persist after page refresh.

- [ ] **Step 4: Run all tests one final time**

```bash
cd /home/danilo/Documents/danilo/chess-practice && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/danilo/Documents/danilo/chess-practice && git add src/Sidebar.jsx src/index.css && git commit -m "feat: add unlock indicator and chunk settings panel to Sidebar"
```
